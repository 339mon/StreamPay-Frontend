import { GET, POST } from "./route";
import { resetRateLimitStore } from "@/app/lib/rate-limit-store";

jest.mock("next/server", () => ({
  NextResponse: {
    json: <T>(body: T, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      json: async () => body,
    }),
  },
}));

const VALID_ADDRESS = "GCLH2SNM5MTV4TGNNOADLYOZJYIFBXTIDVSNW4XP3LEI2UQV2MZ46OD7";
// Right shape, bad strkey checksum
const SHAPE_ONLY_ADDRESS = "GABC2345674567ABCDEFGHIJKLMNOPQRSTUVWXYZ2345674567ABCDEF";
const VALID_CHALLENGE = "streampay_auth_1721800000000_abc123xyz";

function makeGetRequest(params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams(params);
  return {
    nextUrl: { searchParams, pathname: "/api/auth/wallet" },
    headers: { get: () => null },
  } as unknown as import("next/server").NextRequest;
}

function makePostRequest(
  body: unknown,
  csrfCookie?: string,
  csrfHeader?: string,
) {
  return {
    json: async () => {
      if (body === "THROW") throw new Error("parse error");
      return body;
    },
    nextUrl: { pathname: "/api/auth/wallet" },
    headers: {
      get: (name: string) => {
        const lower = name.toLowerCase();
        if (lower === "x-csrf-token") return csrfHeader ?? null;
        if (lower === "x-forwarded-for") return null;
        if (lower === "x-real-ip") return null;
        return null;
      },
    },
    cookies: {
      get: (name: string) =>
        name === "csrf-token" ? (csrfCookie ? { value: csrfCookie } : undefined) : undefined,
    },
  } as unknown as import("next/server").NextRequest;
}

function validPostBody() {
  return {
    address: VALID_ADDRESS,
    challenge: VALID_CHALLENGE,
    signature: "validbase64sig==",
  };
}

function detailFields(res: unknown): string[] {
  return ((res as any).body.error.details as { field: string }[]).map(
    (d) => d.field,
  );
}

beforeEach(() => {
  resetRateLimitStore();
});

describe("GET /api/auth/wallet", () => {
  it("returns 200 with challenge and expires_at for a valid address", async () => {
    const res = await GET(makeGetRequest({ address: VALID_ADDRESS }));
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(typeof body.challenge).toBe("string");
    expect(body.challenge).toMatch(/^streampay_auth_/);
  });

  it("returns 422 VALIDATION_ERROR with details when address is missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(422);
    const body = (res as any).body;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(detailFields(res)).toEqual(["address"]);
  });

  it("returns 422 when address has the right shape but a bad checksum", async () => {
    const res = await GET(makeGetRequest({ address: SHAPE_ONLY_ADDRESS }));
    expect(res.status).toBe(422);
    expect((res as any).body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/auth/wallet validation", () => {
  it("returns 422 with a detail per missing field on an empty body", async () => {
    const res = await POST(makePostRequest({}, "csrf", "csrf"));
    expect(res.status).toBe(422);
    expect(detailFields(res).sort()).toEqual([
      "address",
      "challenge",
      "signature",
    ]);
  });

  it("returns 422 when fields have the wrong type", async () => {
    const res = await POST(
      makePostRequest(
        { address: 5, challenge: true, signature: null },
        "csrf",
        "csrf",
      ),
    );
    expect(res.status).toBe(422);
    expect(detailFields(res).sort()).toEqual([
      "address",
      "challenge",
      "signature",
    ]);
  });

  it("returns 422 when the challenge does not match the issued format", async () => {
    const res = await POST(
      makePostRequest({ ...validPostBody(), challenge: "ch" }, "csrf", "csrf"),
    );
    expect(res.status).toBe(422);
    expect(detailFields(res)).toEqual(["challenge"]);
  });

  it("returns 422 when signature is empty", async () => {
    const res = await POST(
      makePostRequest({ ...validPostBody(), signature: "" }, "csrf", "csrf"),
    );
    expect(res.status).toBe(422);
    expect(detailFields(res)).toEqual(["signature"]);
  });

  it("returns 422 when signature exceeds the maximum length", async () => {
    const res = await POST(
      makePostRequest(
        { ...validPostBody(), signature: "a".repeat(1025) },
        "csrf",
        "csrf",
      ),
    );
    expect(res.status).toBe(422);
    expect(detailFields(res)).toEqual(["signature"]);
  });

  it("returns 422 INVALID_JSON detail when the body is not valid JSON", async () => {
    const res = await POST(makePostRequest("THROW"));
    expect(res.status).toBe(422);
    const body = (res as any).body;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details[0].code).toBe("INVALID_JSON");
  });

  it("ignores unknown extra fields when the known fields are valid", async () => {
    const res = await POST(
      makePostRequest(
        { ...validPostBody(), extra: "ignored" },
        "securecsrf123",
        "securecsrf123",
      ),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/wallet", () => {
  it("returns 403 when csrf token is missing entirely", async () => {
    const res = await POST(makePostRequest(validPostBody()));
    expect(res.status).toBe(403);
  });

  it("returns 403 when csrf tokens are tampered/mismatched", async () => {
    const res = await POST(
      makePostRequest(
        validPostBody(),
        "valid_cookie_token",
        "tampered_header_token",
      ),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 with token for valid matching double-submit CSRF tokens", async () => {
    const res = await POST(
      makePostRequest(validPostBody(), "securecsrf123", "securecsrf123"),
    );
    expect(res.status).toBe(200);
    const body = (res as any).body;
    expect(typeof body.token).toBe("string");
  });

  it("returns 429 when rate limit is exceeded on POST (login)", async () => {
    const req = () =>
      makePostRequest(validPostBody(), "securecsrf123", "securecsrf123");

    // Exhaust the login limit (5/min)
    for (let i = 0; i < 5; i++) {
      const res = await POST(req());
      expect(res.status).toBe(200);
    }

    // 6th request should be rate-limited
    const limited = await POST(req());
    expect(limited.status).toBe(429);
    expect((limited as any).body.error.code).toBe("rate_limit_exceeded");
    expect((limited as any).body.error.message).toBeTruthy();
    expect(typeof (limited as any).body.error.request_id).toBe("string");
  });
});

describe("GET /api/auth/wallet rate limiting", () => {
  it("returns 429 when rate limit is exceeded on GET (challenge)", async () => {
    const req = () => makeGetRequest({ address: VALID_ADDRESS });

    // Exhaust the challenge limit (20/min)
    for (let i = 0; i < 20; i++) {
      const res = await GET(req());
      expect(res.status).toBe(200);
    }

    // 21st request should be rate-limited
    const limited = await GET(req());
    expect(limited.status).toBe(429);
    expect((limited as any).body.error.code).toBe("rate_limit_exceeded");
  });
});
