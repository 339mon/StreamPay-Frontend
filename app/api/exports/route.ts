import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { tryAuthenticateRequest, JWT_SECRET } from "@/app/lib/auth";
import { ExportJob, getStore, encodeCompositeCursor, decodeCompositeCursor } from "@/app/lib/db";
import { checkRateLimit, rateLimitResponse, type ClientIdentity } from "@/app/lib/rate-limit";
import { getLimitForRoute } from "@/app/lib/rate-limit-config";
import { recordRequest, recordThrottle } from "@/app/lib/rate-limit-metrics";
import { withTimeout } from "@/src/middleware/timeout";
import { getCorrelationContext } from "@/app/lib/logger";
import { validateExportRequest } from "@/src/validators/exports";
function getRequestUrl(request: Request): URL {
  try {
    return new URL(request.url);
  } catch {
    return new URL("http://localhost/api/exports");
  }
}

const EXPORT_RETENTION_DAYS = 7;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const EXPORT_PROCESS_DELAY_MS = 50;

/**
 * Default wall-clock budget for POST/GET /api/exports.
 * Override via the `EXPORTS_TIMEOUT_MS` environment variable.
 */
const EXPORTS_TIMEOUT_MS =
  Number(process.env.EXPORTS_TIMEOUT_MS) || 15_000;

function createErrorResponse(code: string, message: string, status: number) {
  const context = getCorrelationContext();
  return NextResponse.json({ error: { code, message, request_id: context?.request_id } }, { status });
}

function createAuditRecord(exportId: string, type: "export.requested" | "export.downloaded" | "export.expired", details?: Record<string, unknown>) {
  getStore().exportRepository.audit.push({
    id: crypto.randomUUID(),
    exportId,
    type,
    timestamp: new Date().toISOString(),
    details,
  });
}

function escapeCsvField(value: string | undefined): string {
  const safe = String(value ?? "").replace(/"/g, '""');
  return `"${safe}"`;
}

/** Creates an HMAC-SHA256 signed download URL scoped to this server. */
function createSignedUrl(jobId: string, expiresAt: string): string {
  const payload = `${jobId}:${expiresAt}`;
  const sig = createHmac("sha256", JWT_SECRET).update(payload).digest("hex");
  const safeId = encodeURIComponent(jobId);
  return `/api/exports/${safeId}?download=true&expires=${encodeURIComponent(expiresAt)}&sig=${sig}`;
}

async function generateExportArtifact(jobId: string) {
  const { exportRepository, streamRepository } = getStore();
  const job = exportRepository.jobs.get(jobId);
  if (!job) return;

  // Scope streams and activity to the job owner
  const streams = Array.from(streamRepository.streams.values())
    .filter((s) => (s as { ownerId?: string }).ownerId === job.ownerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const events = Array.from(streamRepository.activity.values())
    .filter((e) => (e as { ownerId?: string }).ownerId === job.ownerId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const streamRows = streams.map((stream) =>
    ["stream", stream.id, stream.recipient, stream.rate, stream.schedule, stream.status, "", "", ""]
      .map(escapeCsvField)
      .join(",")
  );

  const eventRows = events.map((event) =>
    ["activity", event.streamId ?? "", "", "", "", "", event.type, event.timestamp, event.description]
      .map(escapeCsvField)
      .join(",")
  );

  const allRows = [
    "record_type,stream_id,recipient,rate,schedule,status,event_type,event_timestamp,description",
    ...streamRows,
    ...eventRows,
  ];

  const signedUrlExpiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
  const signedUrl = createSignedUrl(jobId, signedUrlExpiresAt);

  exportRepository.jobs.set(jobId, {
    ...job,
    status: "ready",
    signedUrl,
    signedUrlExpiresAt,
    rows: Math.max(0, allRows.length - 1),
  });

  createAuditRecord(jobId, "export.requested", { rows: allRows.length - 1 });
}

function scheduleExportJob(jobId: string) {
  const { exportRepository } = getStore();
  if (exportRepository.processing.has(jobId)) return;

  const jobPromise = new Promise<void>((resolve) => {
    setTimeout(async () => {
      try {
        await generateExportArtifact(jobId);
      } catch {
        const failedJob = exportRepository.jobs.get(jobId);
        if (failedJob) exportRepository.jobs.set(jobId, { ...failedJob, status: "failed" });
      } finally {
        exportRepository.processing.delete(jobId);
        resolve();
      }
    }, EXPORT_PROCESS_DELAY_MS);
  });

  exportRepository.processing.set(jobId, jobPromise);
}

/**
 * POST /api/exports
 * Creates a new export job for the authenticated user.
 * 
 * Payload:
 * - format: "csv" | "json" (optional, default "csv")
 * - startDate: ISO 8601 datetime (optional)
 * - endDate: ISO 8601 datetime (optional)
 * 
 * Returns 422 if the payload fails validation.
 */
export async function POST(request: Request) {
  return withTimeout(EXPORTS_TIMEOUT_MS, request, async (signal) => {
    const { exportRepository } = getStore();
    const actor = tryAuthenticateRequest(request);
    if (!actor) {
      return createErrorResponse("UNAUTHORIZED", "Missing or invalid authorization header", 401);
    }

    // Limit by the verified wallet, after auth, so a forged bearer token can
    // neither mint fresh buckets nor spend another user's budget.
    const url = getRequestUrl(request);
    const limitType = getLimitForRoute("POST", url.pathname);
    const identity: ClientIdentity = {
      type: "wallet",
      value: actor.walletAddress,
      displayValue: actor.walletAddress.slice(0, 16) + "...",
    };
    const rateCheck = await checkRateLimit(identity, limitType);

    if (!rateCheck.allowed) {
      recordThrottle(url.pathname, limitType, identity.type, identity.displayValue);
      return rateLimitResponse(rateCheck.retryAfter!);
    }
    recordRequest(url.pathname);

    let body: unknown = {};
    try {
      const bodyText = await request.text();
      if (bodyText) {
        body = JSON.parse(bodyText);
      }
    } catch {
      const context = getCorrelationContext();
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Malformed JSON payload",
            request_id: context?.request_id
          }
        },
        { status: 400 }
      );
    }

    const validation = validateExportRequest(body);
    if (!validation.success) {
      const context = getCorrelationContext();
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request payload",
            details: validation.errors,
            request_id: context?.request_id
          }
        },
        { status: 422 }
      );
    }

    const id = crypto.randomUUID();
    const requestedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const job: ExportJob = {
      id,
      ownerId: actor.walletAddress,
      requestedAt,
      status: "pending",
      expiresAt,
      fileName: `streampay-export-${requestedAt.slice(0, 10)}.${validation.data.format}`,
      rows: 0,
    };

    exportRepository.jobs.set(id, job);
    createAuditRecord(id, "export.requested", { requestedAt, retentionDays: EXPORT_RETENTION_DAYS });
    scheduleExportJob(id);

    return NextResponse.json({ data: job, links: { self: `/api/exports/${id}` } }, { status: 201 });
  });
}

export async function GET(request: Request) {
  return withTimeout(EXPORTS_TIMEOUT_MS, request, async (signal) => {
    const { exportRepository } = getStore();
    const actor = tryAuthenticateRequest(request);
    if (!actor) {
      return createErrorResponse("UNAUTHORIZED", "Missing or invalid authorization header", 401);
    }

    const url = getRequestUrl(request);
    const limitType = getLimitForRoute("GET", url.pathname);
    const identity: ClientIdentity = {
      type: "wallet",
      value: actor.walletAddress,
      displayValue: actor.walletAddress.slice(0, 16) + "...",
    };
    const rateCheck = await checkRateLimit(identity, limitType);

    if (!rateCheck.allowed) {
      recordThrottle(url.pathname, limitType, identity.type, identity.displayValue);
      return rateLimitResponse(rateCheck.retryAfter!);
    }
    recordRequest(url.pathname);

    const { searchParams } = url;
    const cursor = searchParams.get("cursor");
    const limitStr = searchParams.get("limit");
    const limit = limitStr ? parseInt(limitStr, 10) : 20;

    if (isNaN(limit) || limit < 1 || limit > 100) {
      return createErrorResponse("VALIDATION_ERROR", "Invalid limit parameter", 422);
    }

    let jobs = Array.from(exportRepository.jobs.values())
      .filter((job) => job.ownerId === actor.walletAddress)
      .sort((left, right) => {
        const timeCompare = right.requestedAt.localeCompare(left.requestedAt);
        return timeCompare !== 0 ? timeCompare : right.id.localeCompare(left.id);
      });

    if (cursor) {
      try {
        const decoded = decodeCompositeCursor(cursor);
        const cursorIndex = jobs.findIndex(
          (job) => job.requestedAt === decoded.timestamp && job.id === decoded.id
        );
        if (cursorIndex >= 0) {
          jobs = jobs.slice(cursorIndex + 1);
        }
      } catch {
        return createErrorResponse("INVALID_CURSOR", "Malformed cursor", 422);
      }
    }

    const paginatedJobs = jobs.slice(0, limit);
    const hasNext = jobs.length > limit;
    const nextCursor =
      hasNext && paginatedJobs.length > 0
        ? encodeCompositeCursor(
            paginatedJobs[paginatedJobs.length - 1].requestedAt,
            paginatedJobs[paginatedJobs.length - 1].id
          )
        : null;

    return NextResponse.json({
      data: paginatedJobs,
      links: { self: `/api/exports?limit=${limit}` },
      meta: { hasNext, nextCursor, total: jobs.length },
    });
  });
}
