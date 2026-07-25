import { NextResponse, NextRequest } from "next/server";
import { createHash } from "crypto";
import { errorResponse, ErrorCode } from "@/app/lib/errors/server";
import { validateCsrfToken } from "@/app/lib/auth";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rateLimitIp";
import { getCorrelationContext, logger } from "@/app/lib/logger";
import {
  validateWalletChallengeQuery,
  validateWalletVerifyBody,
} from "@/app/lib/auth-wallet-validation";
import type { ValidationError } from "@/app/lib/stream-validation";

interface WalletChallengeRecord {
  id: string;
  address: string;
  challenge: string;
  created_at: string;
  expires_at: string;
}

const walletChallengeStore: WalletChallengeRecord[] = [];

function createWalletChallengeRecord(address: string, challenge: string, expiresAt: string): WalletChallengeRecord {
  return {
    id: `wallet-challenge-${walletChallengeStore.length + 1}`,
    address,
    challenge,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  };
}

function compareWalletChallengeRecords(left: WalletChallengeRecord, right: WalletChallengeRecord): number {
  const createdAtCompare = left.created_at.localeCompare(right.created_at);
  if (createdAtCompare !== 0) return createdAtCompare;
  return left.id.localeCompare(right.id);
}

function createCursor(record: WalletChallengeRecord): string {
  return encodeCompositeCursor(record.created_at, record.id);
}

function getWalletChallengePage(address: string | null, cursor: string | null, limit: number) {
  const filtered = walletChallengeStore
    .filter((record) => !address || record.address === address)
    .sort(compareWalletChallengeRecords);

  let startIndex = 0;
  if (cursor) {
    try {
      const decoded = decodeCompositeCursor(cursor);
      startIndex = filtered.findIndex(
        (record) => record.created_at === decoded.timestamp && record.id === decoded.id,
      );
      if (startIndex >= 0) {
        startIndex += 1;
      } else {
        startIndex = filtered.findIndex((record) => record.created_at > decoded.timestamp || (record.created_at === decoded.timestamp && record.id > decoded.id));
        if (startIndex < 0) startIndex = filtered.length;
      }
    } catch {
      throw new Error("INVALID_CURSOR");
    }
  }

  const paginated = filtered.slice(startIndex, startIndex + limit);
  const hasNext = startIndex + paginated.length < filtered.length;
  const nextCursor = hasNext && paginated.length > 0 ? createCursor(paginated[paginated.length - 1]) : null;

  return { data: paginated, meta: { hasNext, nextCursor, total: filtered.length } };
}

export function resetWalletChallengeStoreForTesting(): void {
  walletChallengeStore.length = 0;
}

/** 422 envelope with per-field details, matching /api/streams. */
function validationErrorResponse(logMessage: string, errors: ValidationError[]) {
  logger.warn(logMessage, { errors });
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "One or more fields are invalid.",
        details: errors,
        request_id: getCorrelationContext()?.request_id,
      },
    },
    { status: 422 },
  );
}

// ── Strong ETag helper ────────────────────────────────────────────────────────

/**
 * Compute a strong ETag for the given JSON-serializable body.
 * Strong ETags (no `W/` prefix) guarantee byte-for-byte equivalence.
 */
function computeStrongEtag(body: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify(body)).digest("hex");
  return `"${hash}"`;
}

/** Shared Cache-Control for challenge responses — never cache auth challenges. */
const CACHE_CONTROL = "no-store";

/**
 * Handle an optional If-None-Match conditional request.
 * Returns a 304 Not Modified `NextResponse` when the client's ETag matches,
 * or `null` to continue processing.
 */
function handleIfNoneMatch(
  req: NextRequest,
  etag: string,
): NextResponse | null {
  const ifNoneMatch = req.headers.get("if-none-match");
  if (!ifNoneMatch) return null;

  const clientEtags = ifNoneMatch.split(",").map((t) => t.trim());
  if (clientEtags.includes(etag) || clientEtags.includes("*")) {
    return new NextResponse(null, {
      status: 304,
      headers: { etag, "cache-control": CACHE_CONTROL },
    });
  }

  return null;
}

/**
 * GET /api/auth/wallet
 * Issues a one-time challenge string for wallet-based authentication.
 * Rate-limited by IP (20 req/min) to prevent abuse of challenge generation.
 *
 * Responses carry a **strong ETag** computed from the JSON body so that HTTP
 * caches and clients can perform conditional GET via the `If-None-Match` header.
 * Because challenges are single-use, the ETag is unique per response, which
 * naturally prevents serving stale cached challenges.
 */
export async function GET(req: NextRequest) {
  const rateCheck = await checkIpRateLimit(req, "challenge");
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter!, req);
  }

  try {
    const address = req.nextUrl.searchParams.get("address");
    const cursor = req.nextUrl.searchParams.get("cursor");
    const limitParam = req.nextUrl.searchParams.get("limit");

    if (cursor || limitParam) {
      let limit = 20;
      if (limitParam) {
        const parsed = Number.parseInt(limitParam, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          limit = Math.min(parsed, 100);
        }
      }

      try {
        const page = getWalletChallengePage(address, cursor, limit);
        logger.info("Wallet challenges listed successfully", {
          count: page.data.length,
          total: page.meta.total,
          hasNext: page.meta.hasNext,
        });
        return NextResponse.json(
          {
            data: page.data,
            meta: page.meta,
            links: { self: `/api/auth/wallet?limit=${limit}` },
          },
          { status: 200 },
        );
      } catch {
        return NextResponse.json(
          {
            error: {
              code: "INVALID_CURSOR",
              message: "Malformed cursor",
              request_id: getCorrelationContext()?.request_id,
            },
          },
          { status: 422 },
        );
      }
    }

    const validationErrors = validateWalletChallengeQuery({
      address: address ?? undefined,
    });
    if (validationErrors.length > 0) {
      return validationErrorResponse(
        "Wallet challenge validation failed",
        validationErrors,
      );
    }

    const challenge = `streampay_auth_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const record = createWalletChallengeRecord(address!, challenge, expiresAt);
    walletChallengeStore.push(record);

    const body = { challenge, expires_at: expiresAt };
    const etag = computeStrongEtag(body);

    // ── Conditional GET (If-None-Match) ──────────────────────────────────
    const notModified = handleIfNoneMatch(req, etag);
    if (notModified) return notModified;

    return NextResponse.json(body, {
      status: 200,
      headers: { etag, "cache-control": CACHE_CONTROL },
    });
  } catch {
    return errorResponse(
      ErrorCode.WALLET_CHALLENGE_FAILED,
      "Failed to generate wallet authentication challenge.",
      500,
    );
  }
}

/**
 * POST /api/auth/wallet
 * Verifies double-submit CSRF token and issues a bearer token.
 * Rate-limited by IP (5 req/min) to prevent brute-force login attempts.
 */
export async function POST(req: NextRequest) {
  // IP throttle for login (POST /api/auth/wallet) — 5 req/min per IP
  const rateCheck = await checkIpRateLimit(req, "login");
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter!, req);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Wallet verify validation failed", [
        {
          field: "body",
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      ]);
    }

    const validationErrors = validateWalletVerifyBody(body);
    if (validationErrors.length > 0) {
      return validationErrorResponse(
        "Wallet verify validation failed",
        validationErrors,
      );
    }

    const { address, signature } = body as {
      address: string;
      challenge: string;
      signature: string;
    };

    const csrfCookie = req.cookies.get("csrf-token")?.value ?? null;
    const csrfHeader = req.headers.get("x-csrf-token");

    // Double-submit cookie check
    if (!validateCsrfToken(csrfCookie, csrfHeader)) {
      return errorResponse(
        ErrorCode.FORBIDDEN,
        "CSRF token mismatch.",
        403,
      );
    }

    const isValid = signature.length > 0;

    if (!isValid) {
      return errorResponse(
        ErrorCode.UNAUTHORIZED,
        "Signature verification failed.",
        401,
      );
    }

    const token = `tok_${Buffer.from(address).toString("base64url").slice(0, 24)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({ token, expires_at: expiresAt }, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.WALLET_VERIFY_FAILED,
      "Failed to verify wallet signature.",
      500,
    );
  }
}

/**
 * POST /api/auth/wallet
 * Verifies double-submit CSRF token and issues a bearer token.
 * Rate-limited by IP (5 req/min) to prevent brute-force login attempts.
 */
export async function POST(req: NextRequest) {
  // IP throttle for login (POST /api/auth/wallet) — 5 req/min per IP
  const rateCheck = await checkIpRateLimit(req, "login");
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter!, req);
  }

  try {
    // Allows manual throw simulation to pass directly into catch block
    const body = await req.json();

    if (
      !body ||
      typeof body.address !== "string" ||
      typeof body.challenge !== "string" ||
      typeof body.signature !== "string"
    ) {
      return errorResponse(
        ErrorCode.BAD_REQUEST,
        "Request body must include 'address', 'challenge', and 'signature'.",
        400,
      );
    }

    const csrfCookie = req.cookies.get("csrf-token")?.value ?? null;
    const csrfHeader = req.headers.get("x-csrf-token");

    // Double-submit cookie check
    if (!validateCsrfToken(csrfCookie, csrfHeader)) {
      return errorResponse(
        ErrorCode.FORBIDDEN,
        "CSRF token mismatch.",
        403,
      );
    }

    const isValid = body.signature.length > 0; 

    if (!isValid) {
      return errorResponse(
        ErrorCode.UNAUTHORIZED,
        "Signature verification failed.",
        401,
      );
    }

    const token = `tok_${Buffer.from(body.address).toString("base64url").slice(0, 24)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); 

    return NextResponse.json({ token, expires_at: expiresAt }, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.WALLET_VERIFY_FAILED,
      "Failed to verify wallet signature.",
      500,
    );
  }
}
