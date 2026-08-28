/** @jest-environment node */

import { GET } from "./route";
import { applyRateLimit } from "@/src/middleware/rateLimit";

jest.mock("@/app/lib/admin-guard", () => ({
  isCircuitBreakerOpen: jest.fn(() => false),
}));

jest.mock("@/src/middleware/rateLimit", () => ({
  applyRateLimit: jest.fn(),
}));

describe("GET /api/indexer/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (applyRateLimit as jest.Mock).mockResolvedValue(null);
  });

  it("applies the shared per-identity read limit before opening the stream", async () => {
    const request = new Request("http://localhost/api/indexer/status", {
      headers: {
        "X-API-Key": "status-client-key",
      },
    });

    const response = await GET(request);

    expect(applyRateLimit).toHaveBeenCalledWith(request, "indexer/status", "GET");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
  });

  it("returns the rate-limit response without creating a stream when the identity is exhausted", async () => {
    const limitedResponse = Response.json(
      {
        error: {
          code: "rate_limit_exceeded",
          message: "Rate limit exceeded. Please try again later.",
          request_id: "req-test",
        },
      },
      {
        status: 429,
        headers: { "Retry-After": "60" },
      },
    );
    (applyRateLimit as jest.Mock).mockResolvedValueOnce(limitedResponse);

    const request = new Request("http://localhost/api/indexer/status", {
      headers: {
        "X-API-Key": "status-client-key",
      },
    });

    const response = await GET(request);

    expect(response).toBe(limitedResponse);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });
});
