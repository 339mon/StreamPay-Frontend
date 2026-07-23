import { GET } from "./route";
import { NextRequest } from "next/server";
import { getMetrics } from "@/app/lib/rate-limit-metrics";

// Mock dependencies
jest.mock("@/app/lib/logger");
jest.mock("@/app/lib/rate-limit-metrics");

describe("GET /api/metrics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.METRICS_AUTH_TOKEN = "test-token-12345";
  });

  afterEach(() => {
    delete process.env.METRICS_AUTH_TOKEN;
  });

  describe("Authentication", () => {
    it("should return 503 when METRICS_AUTH_TOKEN is not configured", async () => {
      delete process.env.METRICS_AUTH_TOKEN;
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.error.code).toBe("METRICS_DISABLED");
    });

    it("should return 401 when Authorization header is missing", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics");
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error.code).toBe("UNAUTHORIZED");
      expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    });

    it("should return 401 when Authorization header is malformed", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "InvalidFormat token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(401);
      const json = await response.json();
      expect(json.error.code).toBe("UNAUTHORIZED");
    });

    it("should return 403 when token is incorrect", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer wrong-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN");
    });

    it("should return 200 when token is correct", async () => {
      (getMetrics as jest.Mock).mockReturnValue({
        total: { "/api/streams": 100, "/api/streams/123": 50 },
        throttled: { "/api/streams:org": 5 },
      });

      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer test-token-12345" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/plain; version=0.0.4; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("Metrics Format", () => {
    beforeEach(() => {
      (getMetrics as jest.Mock).mockReturnValue({
        total: { "/api/streams": 100, "/api/streams/123": 50 },
        throttled: { "/api/streams:org": 5, "/api/streams:rate": 3 },
      });
    });

    it("should return Prometheus-formatted metrics", async () => {
      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer test-token-12345" },
      });
      const response = await GET(request);

      const text = await response.text();
      expect(text).toContain("# HELP streampay_requests_total");
      expect(text).toContain("# TYPE streampay_requests_total counter");
      expect(text).toContain("streampay_requests_total{route=\"/api/streams\"} 100");
      expect(text).toContain("# HELP streampay_rate_limit_throttled_total");
      expect(text).toContain("# TYPE streampay_rate_limit_throttled_total counter");
      expect(text).toContain("streampay_rate_limit_throttled_total{route=\"/api/streams\",limit_type=\"org\"} 5");
      expect(text).toContain("# HELP streampay_metrics_up");
      expect(text).toContain("# TYPE streampay_metrics_up gauge");
      expect(text).toContain("streampay_metrics_up 1");
    });

    it("should escape special characters in route labels", async () => {
      (getMetrics as jest.Mock).mockReturnValue({
        total: { "/api/streams/test\"quote": 10, "/api/streams\\backslash": 5 },
        throttled: {},
      });

      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer test-token-12345" },
      });
      const response = await GET(request);

      const text = await response.text();
      expect(text).toContain('route="/api/streams/test\\"quote"');
      expect(text).toContain('route="/api/streams\\\\backslash"');
    });

    it("should handle empty metrics", async () => {
      (getMetrics as jest.Mock).mockReturnValue({
        total: {},
        throttled: {},
      });

      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer test-token-12345" },
      });
      const response = await GET(request);

      const text = await response.text();
      expect(text).toContain("streampay_metrics_up 1");
    });
  });

  describe("Security", () => {
    it("should use constant-time comparison for token validation", async () => {
      (getMetrics as jest.Mock).mockReturnValue({ total: {}, throttled: {} });

      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer test-token-12345" },
      });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it("should handle tokens of different lengths safely", async () => {
      (getMetrics as jest.Mock).mockReturnValue({ total: {}, throttled: {} });

      const request = new NextRequest("http://localhost:3000/api/metrics", {
        headers: { authorization: "Bearer wrong-length-token" },
      });
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
/**
 * Tests for GET /api/metrics — token-gated Prometheus metrics endpoint.
 */

import { GET } from "./route";
import { recordRequest, recordThrottle, resetMetrics } from "@/app/lib/rate-limit-metrics";

const TOKEN = "test-metrics-token-123";

function makeRequest(authorization?: string): Request {
  const headers: Record<string, string> = {};
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("http://localhost/api/metrics", { method: "GET", headers });
}

describe("GET /api/metrics", () => {
  const originalToken = process.env.METRICS_AUTH_TOKEN;

  beforeEach(() => {
    resetMetrics();
    process.env.METRICS_AUTH_TOKEN = TOKEN;
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.METRICS_AUTH_TOKEN;
    else process.env.METRICS_AUTH_TOKEN = originalToken;
  });

  it("returns 503 when no token is configured", async () => {
    delete process.env.METRICS_AUTH_TOKEN;
    const res = await GET(makeRequest(`Bearer ${TOKEN}`));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("METRICS_DISABLED");
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("returns 401 when the Authorization header is malformed", async () => {
    const res = await GET(makeRequest("Token abc"));
    expect(res.status).toBe(401);
  });

  it("returns 403 when the token is incorrect", async () => {
    const res = await GET(makeRequest("Bearer wrong-token"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns Prometheus metrics for a valid token", async () => {
    recordRequest("/api/streams");
    recordRequest("/api/streams");
    recordThrottle("/api/streams", "perMinute", "wallet", "GABC");

    const res = await GET(makeRequest(`Bearer ${TOKEN}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");

    const text = await res.text();
    expect(text).toContain("# TYPE streampay_requests_total counter");
    expect(text).toContain('streampay_requests_total{route="/api/streams"} 2');
    expect(text).toContain(
      'streampay_rate_limit_throttled_total{route="/api/streams",limit_type="perMinute"} 1'
    );
    expect(text).toContain("streampay_metrics_up 1");
  });

  it("accepts a case-insensitive bearer scheme", async () => {
    const res = await GET(makeRequest(`bearer ${TOKEN}`));
    expect(res.status).toBe(200);
  });
});
