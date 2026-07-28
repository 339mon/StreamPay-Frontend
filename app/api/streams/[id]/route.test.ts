/** @jest-environment node */
import { GET, POST, DELETE } from "./route";
import { db, resetDb } from "@/app/lib/db";
import { createCache } from "@/app/lib/cache";
import { resetRateLimitStore } from "@/app/lib/rate-limit-store";

describe("Stream Details Route - GET /api/streams/:id and mutations", () => {
  const streamId = "stream-ada";
  const tenantId = "org-acme";

  beforeEach(async () => {
    resetDb();
    resetRateLimitStore();

    // Populate tenant field on the stream in DB for testing finding by tenant
    const stream = db.streams.get(streamId);
    if (stream) {
      (stream as any).tenant = tenantId;
      db.streams.set(streamId, stream);
    }

    // Set default cache state (disabled by default in tests)
    process.env.STREAMPAY_CACHE_DISABLED = "true";
  });

  it("returns 400 Bad Request if tenant ID is empty/missing", async () => {
    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "GET",
      headers: {}, // no x-tenant-id
    });
    const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_TENANT");
  });

  it("handles GET cache HIT and MISS correctly", async () => {
    // Enable cache specifically for this test
    process.env.STREAMPAY_CACHE_DISABLED = "false";

    // We want to verify cache hits.
    // First, let's spy on streamCache methods to delegate to a live cache
    const mod = await import("@/app/lib/cache");
    const liveCache = createCache<any>("stream", 300000);

    const getSpy = jest.spyOn(mod.streamCache, "get").mockImplementation((t, id) => liveCache.get(t, id));
    const setSpy = jest.spyOn(mod.streamCache, "set").mockImplementation((t, id, v) => liveCache.set(t, id, v));
    const invalidateSpy = jest.spyOn(mod.streamCache, "invalidate").mockImplementation((t, id) => liveCache.invalidate(t, id));

    try {
      // First request -> Cache MISS
      const req1 = new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET",
        headers: { "x-tenant-id": tenantId },
      });
      const res1 = await GET(req1, { params: Promise.resolve({ id: streamId }) });
      expect(res1.status).toBe(200);
      expect(res1.headers.get("X-Cache")).toBe("MISS");
      expect(getSpy).toHaveBeenCalledWith(tenantId, streamId);
      expect(setSpy).toHaveBeenCalled();

      // Second request -> Cache HIT
      const req2 = new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET",
        headers: { "x-tenant-id": tenantId },
      });
      const res2 = await GET(req2, { params: Promise.resolve({ id: streamId }) });
      expect(res2.status).toBe(200);
      expect(res2.headers.get("X-Cache")).toBe("HIT");

      const body = await res2.json();
      expect(body.data.id).toBe(streamId);
    } finally {
      getSpy.mockRestore();
      setSpy.mockRestore();
      invalidateSpy.mockRestore();
    }
  });

  it("enforces cross-tenant isolation on DB reads", async () => {
    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "GET",
      headers: { "x-tenant-id": "wrong-tenant" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
    expect(res.status).toBe(404);
  });

  it("invalidates cache on POST and DELETE mutations", async () => {
    process.env.STREAMPAY_CACHE_DISABLED = "false";

    const mod = await import("@/app/lib/cache");
    const liveCache = createCache<any>("stream", 300000);

    // Seed liveCache
    const stream = db.streams.get(streamId)!;
    liveCache.set(tenantId, streamId, stream);

    const getSpy = jest.spyOn(mod.streamCache, "get").mockImplementation((t, id) => liveCache.get(t, id));
    const invalidateSpy = jest.spyOn(mod.streamCache, "invalidate").mockImplementation((t, id) => liveCache.invalidate(t, id));

    try {
      // Verify cached initially
      expect(liveCache.get(tenantId, streamId)).not.toBeNull();

      // POST updates stream and invalidates cache
      const reqPOST = new Request(`http://localhost/api/streams/${streamId}`, {
        method: "POST",
        headers: { "x-tenant-id": tenantId, "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Updated Label" }),
      });
      const resPOST = await POST(reqPOST, { params: Promise.resolve({ id: streamId }) });
      expect(resPOST.status).toBe(200);
      expect(invalidateSpy).toHaveBeenCalledWith(tenantId, streamId);
      expect(liveCache.get(tenantId, streamId)).toBeNull();

      // Seed cache again
      liveCache.set(tenantId, streamId, stream);

      // DELETE deletes stream and invalidates cache
      // Make stream deletable (not active/paused)
      const nonActiveStream = { ...stream, status: "ended" as const };
      db.streams.set(streamId, nonActiveStream);
      liveCache.set(tenantId, streamId, nonActiveStream);

      const reqDELETE = new Request(`http://localhost/api/streams/${streamId}`, {
        method: "DELETE",
        headers: { "x-tenant-id": tenantId },
      });
      const resDELETE = await DELETE(reqDELETE, { params: Promise.resolve({ id: streamId }) });
      expect(resDELETE.status).toBe(204);
      expect(invalidateSpy).toHaveBeenCalledWith(tenantId, streamId);
      expect(liveCache.get(tenantId, streamId)).toBeNull();
    } finally {
      getSpy.mockRestore();
      invalidateSpy.mockRestore();
    }
  });

  it("handles non-existent streams in POST/DELETE", async () => {
    const reqPOST = new Request(`http://localhost/api/streams/non-existent`, {
      method: "POST",
      headers: { "x-tenant-id": tenantId, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Updated Label" }),
    });
    const resPOST = await POST(reqPOST, { params: Promise.resolve({ id: "non-existent" }) });
    expect(resPOST.status).toBe(404);

    const reqDELETE = new Request(`http://localhost/api/streams/non-existent`, {
      method: "DELETE",
      headers: { "x-tenant-id": tenantId },
    });
    const resDELETE = await DELETE(reqDELETE, { params: Promise.resolve({ id: "non-existent" }) });
    expect(resDELETE.status).toBe(404);
  });

  it("handles malformed JSON body in POST", async () => {
    const reqPOST = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "POST",
      headers: { "x-tenant-id": tenantId, "Content-Type": "application/json" },
      body: "invalid-json",
    });
    const resPOST = await POST(reqPOST, { params: Promise.resolve({ id: streamId }) });
    expect(resPOST.status).toBe(400);
  });
});

describe("Stream Details Route - GET /api/streams/:id ETag + 304 short-circuit", () => {
  const streamId = "stream-ada";
  const tenantId = "org-acme";

  beforeEach(async () => {
    resetDb();
    resetRateLimitStore();
    const stream = db.streams.get(streamId);
    if (stream) {
      (stream as any).tenant = tenantId;
      db.streams.set(streamId, stream);
    }
    process.env.STREAMPAY_CACHE_DISABLED = "true";
  });

  it("returns ETag and Cache-Control on a cache-MISS response", async () => {
    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "GET",
      headers: { "x-tenant-id": tenantId },
    });
    const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
    expect(res.status).toBe(200);
    const tag = res.headers.get("ETag");
    expect(tag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    expect(res.headers.get("X-Cache")).toBe("MISS");
  });

  it("returns ETag on a cache-HIT response too", async () => {
    process.env.STREAMPAY_CACHE_DISABLED = "false";
    const mod = await import("@/app/lib/cache");
    const liveCache = createCache<any>("stream", 300000);
    const stream = db.streams.get(streamId)!;
    liveCache.set(tenantId, streamId, stream);
    const getSpy = jest.spyOn(mod.streamCache, "get").mockImplementation((t, id) => liveCache.get(t, id));

    try {
      const req = new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET",
        headers: { "x-tenant-id": tenantId },
      });
      const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Cache")).toBe("HIT");
      expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
    } finally {
      getSpy.mockRestore();
    }
  });

  it("returns 304 with empty body when If-None-Match matches current ETag", async () => {
    // Prime cache so the ETag computation is stable across calls.
    process.env.STREAMPAY_CACHE_DISABLED = "false";
    const mod = await import("@/app/lib/cache");
    const liveCache = createCache<any>("stream", 300000);
    const stream = db.streams.get(streamId)!;
    liveCache.set(tenantId, streamId, stream);
    const getSpy = jest.spyOn(mod.streamCache, "get").mockImplementation((t, id) => liveCache.get(t, id));

    try {
      // First, fetch to obtain the current ETag
      const initial = await GET(
        new Request(`http://localhost/api/streams/${streamId}`, {
          method: "GET",
          headers: { "x-tenant-id": tenantId },
        }),
        { params: Promise.resolve({ id: streamId }) }
      );
      const etag = initial.headers.get("ETag");
      expect(etag).not.toBeNull();

      // Replay with If-None-Match -> 304, empty body, ETag preserved
      const replay = await GET(
        new Request(`http://localhost/api/streams/${streamId}`, {
          method: "GET",
          headers: { "x-tenant-id": tenantId, "If-None-Match": etag! },
        }),
        { params: Promise.resolve({ id: streamId }) }
      );
      expect(replay.status).toBe(304);
      expect(replay.headers.get("ETag")).toBe(etag);
      expect(replay.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
      expect(replay.headers.get("X-Cache")).toBe("HIT");
      const body = await replay.text();
      expect(body).toBe("");
    } finally {
      getSpy.mockRestore();
    }
  });

  it("honors weak form (W/\"...\") in If-None-Match because weak comparison applies", async () => {
    process.env.STREAMPAY_CACHE_DISABLED = "false";
    const mod = await import("@/app/lib/cache");
    const liveCache = createCache<any>("stream", 300000);
    liveCache.set(tenantId, streamId, db.streams.get(streamId)!);
    const getSpy = jest.spyOn(mod.streamCache, "get").mockImplementation((t, id) => liveCache.get(t, id));

    try {
      const initial = await GET(
        new Request(`http://localhost/api/streams/${streamId}`, {
          method: "GET", headers: { "x-tenant-id": tenantId },
        }),
        { params: Promise.resolve({ id: streamId }) }
      );
      const tag = initial.headers.get("ETag")!;

      const replay = await GET(
        new Request(`http://localhost/api/streams/${streamId}`, {
          method: "GET",
          headers: { "x-tenant-id": tenantId, "If-None-Match": `W/${tag}` },
        }),
        { params: Promise.resolve({ id: streamId }) }
      );
      expect(replay.status).toBe(304);
    } finally {
      getSpy.mockRestore();
    }
  });

  it("honors wildcard '*' If-None-Match (RFC 7232: match if resource exists)", async () => {
    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "GET",
      headers: { "x-tenant-id": tenantId, "If-None-Match": "*" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it("returns 200 when If-None-Match holds a non-matching tag", async () => {
    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "GET",
      headers: { "x-tenant-id": tenantId, "If-None-Match": `"some-other-tag"` },
    });
    const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
    expect(res.status).toBe(200);
  });

  it("tolerates malformed If-None-Match by falling through to 200", async () => {
    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "GET",
      headers: { "x-tenant-id": tenantId, "If-None-Match": "totally-not-a-tag" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: streamId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toMatch(/^"[0-9a-f]{64}"$/);
  });

  it("matches when the supplied tag is one entry in a comma-separated list", async () => {
    const initial = await GET(
      new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET", headers: { "x-tenant-id": tenantId },
      }),
      { params: Promise.resolve({ id: streamId }) }
    );
    const tag = initial.headers.get("ETag")!;

    const replay = await GET(
      new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET",
        headers: { "x-tenant-id": tenantId, "If-None-Match": `"other-1", ${tag}, W/"other-2"` },
      }),
      { params: Promise.resolve({ id: streamId }) }
    );
    expect(replay.status).toBe(304);
  });

  it("produces a different ETag for different tenants holding the same id (no cache poisoning)", async () => {
    // Seed a parallel stream row owned by a *different* tenant so that the
    // tenant isolation actually exercises two real 200 paths. Without this
    // fixture the cross-tenant lookup short-circuits to 404 and the comparison
    // would be meaningless.
    const altTenant = "org-other";
    const altStream = {
      id: streamId,
      tenant: altTenant,
      recipient: "Other Tenant Recipient",
      rate: "0 XLM",
      schedule: "alt schedule",
      status: "draft",
      nextAction: "start",
      createdAt: "2026-04-01T09:00:00Z",
      updatedAt: "2026-04-28T10:30:00Z",
      // Force a distinct body so the test isn't just hashing the same JSON.
      magicField: altTenant,
    } as any;
    db.streams.set(streamId, altStream);

    const tagAcme = await getEtag(streamId, tenantId);
    const tagOther = await getEtag(streamId, altTenant);
    expect(tagAcme).toMatch(/^"[0-9a-f]{64}"$/);
    expect(tagOther).toMatch(/^"[0-9a-f]{64}"$/);
    expect(tagAcme).not.toBe(tagOther);
  });

  it("flips the ETag after a POST mutation (cache invalidation)", async () => {
    const before = await getEtag(streamId, tenantId);

    const req = new Request(`http://localhost/api/streams/${streamId}`, {
      method: "POST",
      headers: { "x-tenant-id": tenantId, "Content-Type": "application/json" },
      body: JSON.stringify({ label: "Renamed Stream" }),
    });
    const post = await POST(req, { params: Promise.resolve({ id: streamId }) });
    expect(post.status).toBe(200);

    const after = await getEtag(streamId, tenantId);
    expect(after).not.toBe(before);
  });

  it("replays the same ETag for two back-to-back GETs of the same resource", async () => {
    const tag1 = await getEtag(streamId, tenantId);
    const tag2 = await getEtag(streamId, tenantId);
    expect(tag1).toBe(tag2);
  });

  it("returns 304 with `X-Cache: MISS` when `If-None-Match` matches a freshly DB-read stream", async () => {
    // Cache disabled -> first GET performs a DB fetch (X-Cache: MISS).
    const tenant = tenantId;
    const initial = await getEtag(streamId, tenant);
    expect(initial).toMatch(/^"[0-9a-f]{64}"$/);

    const replay = await GET(
      new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET",
        headers: { "x-tenant-id": tenant, "If-None-Match": initial },
      }),
      { params: Promise.resolve({ id: streamId }) }
    );
    expect(replay.status).toBe(304);
    expect(replay.headers.get("ETag")).toBe(initial);
    expect(replay.headers.get("X-Cache")).toBe("MISS");
    // 304 must carry the same cache directives as 200 so the client
    // can revalidate its freshness bookkeeping.
    expect(replay.headers.get("Cache-Control")).toBe("private, max-age=0, must-revalidate");
    const body = await replay.text();
    expect(body).toBe("");
  });

  it("If-None-Match: * on a stream the requester does not own returns 404, not 304", async () => {
    // Initialize the fixture under tenantId, then probe with the *wrong*
    // tenant. Tenant isolation must fire *before* the ETag computation so
    // we never leak presence via 304.
    const wrongTenant = "org-not-yours";
    const res = await GET(
      new Request(`http://localhost/api/streams/${streamId}`, {
        method: "GET",
        headers: { "x-tenant-id": wrongTenant, "If-None-Match": "*" },
      }),
      { params: Promise.resolve({ id: streamId }) }
    );
    expect(res.status).toBe(404);
    expect(res.headers.get("ETag")).toBeNull();
    expect(res.headers.get("X-Cache")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBeNull();
  });

  async function getEtag(id: string, tenant: string): Promise<string> {
    const res = await GET(
      new Request(`http://localhost/api/streams/${id}`, {
        method: "GET",
        headers: { "x-tenant-id": tenant },
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(res.status).toBe(200);
    return res.headers.get("ETag") as string;
  }
});
