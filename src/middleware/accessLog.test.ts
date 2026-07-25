import { logAccessEvent } from "./accessLog";
import { getCorrelationContext, logger } from "@/app/lib/logger";

jest.mock("@/app/lib/logger", () => ({
  getCorrelationContext: jest.fn(),
  logger: { info: jest.fn() },
}));

describe("logAccessEvent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs a generic access message with the caller's context", () => {
    (getCorrelationContext as jest.Mock).mockReturnValue(undefined);

    logAccessEvent({ method: "GET", path: "/api/streams", status: 200, durationMs: 12 });

    expect(logger.info).toHaveBeenCalledWith(
      "http access",
      expect.objectContaining({ method: "GET", path: "/api/streams", status: 200, durationMs: 12 }),
    );
  });

  it("does not hardcode a route-specific message", () => {
    (getCorrelationContext as jest.Mock).mockReturnValue(undefined);

    logAccessEvent({ method: "POST", path: "/api/streams", status: 201 });

    const [message] = (logger.info as jest.Mock).mock.calls[0];
    expect(message).not.toMatch(/wallet/i);
  });

  it("attaches correlation, request and trace identifiers when present", () => {
    (getCorrelationContext as jest.Mock).mockReturnValue({
      request_id: "req-1",
      correlation_id: "corr-1",
      traceparent: "00-trace-1",
    });

    logAccessEvent({ method: "GET", path: "/api/streams", status: 200 });

    expect(logger.info).toHaveBeenCalledWith(
      "http access",
      expect.objectContaining({
        request_id: "req-1",
        correlation_id: "corr-1",
        traceparent: "00-trace-1",
      }),
    );
  });

  it("passes through arbitrary extra fields (e.g. errorCode)", () => {
    (getCorrelationContext as jest.Mock).mockReturnValue(undefined);

    logAccessEvent({
      method: "GET",
      path: "/api/streams",
      status: 429,
      errorCode: "rate_limit_exceeded",
    });

    expect(logger.info).toHaveBeenCalledWith(
      "http access",
      expect.objectContaining({ errorCode: "rate_limit_exceeded" }),
    );
  });
});
