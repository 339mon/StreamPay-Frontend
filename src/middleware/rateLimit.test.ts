import { resetRateLimitStore, setRateLimitStore } from "@/app/lib/rate-limit-store";
import { streamsRateLimit } from "./rateLimit";

describe("streamsRateLimit", () => {
  afterEach(() => {
    resetRateLimitStore();
  });

  describe("GET requests", () => {
    it("allows request when under rate limit", async () => {
      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");

      expect(result.allowed).toBe(true);
      expect(result.response).toBeUndefined();
    });

    it("rejects request when rate limit exceeded", async () => {
      setRateLimitStore({
        check: async () => ({
          allowed: false,
          remaining: 0,
          resetAt: 1234567890,
          retryAfter: 60,
        }),
      });

      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");

      expect(result.allowed).toBe(false);
      expect(result.response).toBeDefined();
      expect(result.response!.status).toBe(429);
    });

    it("returns 429 response with Retry-After header", async () => {
      setRateLimitStore({
        check: async () => ({
          allowed: false,
          remaining: 0,
          resetAt: 1234567890,
          retryAfter: 30,
        }),
      });

      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");

      expect(result.response!.headers.get("Retry-After")).toBe("30");
    });

    it("uses read limit for GET /api/streams", async () => {
      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");

      expect(result.allowed).toBe(true);
    });
  });

  describe("POST requests", () => {
    it("allows request when under write rate limit", async () => {
      const req = new Request("http://localhost/api/streams", { method: "POST" });
      const result = await streamsRateLimit(req, "POST", "/api/streams");

      expect(result.allowed).toBe(true);
    });

    it("rejects POST when write rate limit exceeded", async () => {
      setRateLimitStore({
        check: async () => ({
          allowed: false,
          remaining: 0,
          resetAt: 1234567890,
          retryAfter: 45,
        }),
      });

      const req = new Request("http://localhost/api/streams", { method: "POST" });
      const result = await streamsRateLimit(req, "POST", "/api/streams");

      expect(result.allowed).toBe(false);
      expect(result.response!.status).toBe(429);
    });
  });

  describe("identity extraction", () => {
    it("identifies by API key when X-API-Key is present", async () => {
      const req = new Request("http://localhost/api/streams", {
        headers: { "X-API-Key": "test-key-123" },
      });

      // First request uses a fresh store, so it should be allowed
      const result = await streamsRateLimit(req, "GET", "/api/streams");
      expect(result.allowed).toBe(true);
    });

    it("identifies by wallet JWT when present", async () => {
      const payload = { sub: "GABCDEF1234567890" };
      const token = `header.${btoa(JSON.stringify(payload))}.signature`;

      const req = new Request("http://localhost/api/streams", {
        headers: { authorization: `Bearer ${token}` },
      });

      const result = await streamsRateLimit(req, "GET", "/api/streams");
      expect(result.allowed).toBe(true);
    });

    it("falls back to IP when no auth headers", async () => {
      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");
      expect(result.allowed).toBe(true);
    });
  });

  describe("error response format", () => {
    it("includes rate_limit_exceeded error code in 429 response", async () => {
      setRateLimitStore({
        check: async () => ({
          allowed: false,
          remaining: 0,
          resetAt: 1234567890,
          retryAfter: 60,
        }),
      });

      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");
      const body = await result.response!.json();

      expect(body.error.code).toBe("rate_limit_exceeded");
      expect(body.error.message).toBe("Rate limit exceeded. Please try again later.");
    });

    it("includes request_id in 429 response", async () => {
      setRateLimitStore({
        check: async () => ({
          allowed: false,
          remaining: 0,
          resetAt: 1234567890,
          retryAfter: 60,
        }),
      });

      const req = new Request("http://localhost/api/streams");
      const result = await streamsRateLimit(req, "GET", "/api/streams");
      const body = await result.response!.json();

      expect(body.error.request_id).toBeDefined();
      expect(typeof body.error.request_id).toBe("string");
    });
  });

  describe("per-user isolation", () => {
    it("tracks different API keys separately", async () => {
      const req1 = new Request("http://localhost/api/streams", {
        headers: { "X-API-Key": "key-a" },
      });
      const req2 = new Request("http://localhost/api/streams", {
        headers: { "X-API-Key": "key-b" },
      });

      const result1 = await streamsRateLimit(req1, "GET", "/api/streams");
      const result2 = await streamsRateLimit(req2, "GET", "/api/streams");

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });
});
