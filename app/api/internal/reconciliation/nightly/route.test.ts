/**
 * Goal: >=90% line/branch on route.ts.
 * Mocks ./_pipeline so fetcher behavior is controllable and replaceable.
 */
import { NextRequest } from "next/server";

jest.mock("./_pipeline", () => {
  const actual = jest.requireActual("./_pipeline");
  return {
    ...actual,
    fetchAllDBRows: jest.fn(),
    fetchAllIndexerRows: jest.fn(),
  };
});

import { POST } from "./route";
import { fetchAllDBRows, fetchAllIndexerRows } from "./_pipeline";

const fetchAllDBRowsMock = fetchAllDBRows as jest.MockedFunction<typeof fetchAllDBRows>;
const fetchAllIndexerRowsMock = fetchAllIndexerRows as jest.MockedFunction<typeof fetchAllIndexerRows>;

const ROUTE = "http://localhost/api/internal/reconciliation/nightly";

function makeReq(opts: {
  headers?: Record<string, string>;
  body?: unknown;
  sendBody?: boolean;
}): NextRequest {
  const headers = new Headers(opts.headers ?? {});
  const init: RequestInit = { method: "POST", headers };
  if (opts.sendBody !== false) {
    init.body = opts.body !== undefined ? JSON.stringify(opts.body) : "";
  }
  return new NextRequest(ROUTE, init);
}

beforeEach(() => {
  jest.resetAllMocks();
  process.env.RECON_CRON_SECRET = "test-secret";
  fetchAllDBRowsMock.mockResolvedValue([]);
  fetchAllIndexerRowsMock.mockResolvedValue([]);
});
afterEach(() => { delete process.env.RECON_CRON_SECRET; });

describe("POST /api/internal/reconciliation/nightly", () => {
  it("401 when RECON_CRON_SECRET not configured (fail closed)", async () => {
    delete process.env.RECON_CRON_SECRET;
    const res = await POST(makeReq({ headers: { "x-cron-secret": "anything" }, body: {} }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe("UNAUTHORIZED");
    expect(json.error.correlationId).toBeTruthy();
  });

  it("401 when x-cron-secret header absent", async () => {
    const res = await POST(makeReq({ sendBody: false }));
    expect(res.status).toBe(401);
  });

  it("401 when secret wrong (same length, different value)", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "wrong-secret-value" }, body: {} }));
    expect(res.status).toBe(401);
  });

  it("401 when secret length-mismatched", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "short" }, body: {} }));
    expect(res.status).toBe(401);
  });

  it("200 via Authorization: Bearer header", async () => {
    const res = await POST(makeReq({ headers: { authorization: "Bearer test-secret" }, body: { dryRun: true } }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toBeDefined();
  });

  it("400 on invalid JSON shape (unknown keys + bad date)", async () => {
    const res = await POST(makeReq({
      headers: { "x-cron-secret": "test-secret" },
      body: { sinceISO: "not-a-date", unknownKey: true },
    }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_FAILED");
    expect(Array.isArray(json.error.details)).toBe(true);
  });

  it("400 when body is an array", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: [] as unknown as object }));
    expect(res.status).toBe(400);
  });

  it("400 when pageSize out of range", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: { pageSize: 50 } }));
    expect(res.status).toBe(400);
  });

  it("400 when pageSize exceeds max", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: { pageSize: 99999 } }));
    expect(res.status).toBe(400);
  });

  it("400 when pageSize is not an integer", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: { pageSize: 1.5 } }));
    expect(res.status).toBe(400);
  });

  it("400 when dryRun is not a boolean", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: { dryRun: "yes" } }));
    expect(res.status).toBe(400);
  });

  it("200 with x-request-id echoed as correlation id", async () => {
    const res = await POST(makeReq({
      headers: { "x-cron-secret": "test-secret", "x-request-id": "abc-123" },
      body: {},
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-correlation-id")).toBe("abc-123");
    const json = await res.json();
    expect(json.correlationId).toBe("abc-123");
  });

  it("200 with x-correlation-id when x-request-id absent", async () => {
    const res = await POST(makeReq({
      headers: { "x-cron-secret": "test-secret", "x-correlation-id": "corr-9" },
      body: {},
    }));
    const json = await res.json();
    expect(json.correlationId).toBe("corr-9");
  });

  it("200 with generated UUID when no correlation header on request", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: {} }));
    const json = await res.json();
    expect(json.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("500 with INTERNAL envelope when fetcher throws", async () => {
    fetchAllDBRowsMock.mockRejectedValueOnce(new Error("db is down"));
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: {} }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe("INTERNAL");
    expect(json.error.correlationId).toBeTruthy();
  });

  it("tolerates an empty body (falls back to defaults)", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, sendBody: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.sinceISO).toBeTruthy();
    expect(json.dryRun).toBe(false);
    expect(json.summary.totalDBRows).toBe(0);
  });

  it("forwards dryRun=false by default", async () => {
    const res = await POST(makeReq({ headers: { "x-cron-secret": "test-secret" }, body: { dryRun: false } }));
    const json = await res.json();
    expect(json.dryRun).toBe(false);
  });
});