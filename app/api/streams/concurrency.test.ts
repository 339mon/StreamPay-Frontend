import { NextRequest } from "next/server";
import { POST as pauseHandler } from "./[id]/pause/route";
import { POST as startHandler } from "./[id]/start/route";
import { POST as stopHandler } from "./[id]/stop/route";
import { POST as settleHandler } from "./[id]/settle/route";
import { db, resetDb } from "@/app/lib/db";
import type { Stream } from "@/app/types/openapi";

function makeReq(idempotencyKey?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (idempotencyKey) {
    headers["idempotency-key"] = idempotencyKey;
  }
  return new NextRequest("http://localhost/api/streams/s1/pause", {
    method: "POST",
    headers,
  });
}

function makeParams(id = "s1") {
  return { params: Promise.resolve({ id }) };
}

function seedActiveStream(id = "s1"): Stream {
  const stream: Stream = {
    id,
    sender: "sender-1",
    recipient: "recipient-1",
    flowRate: "100",
    deposit: "1000",
    remainingBalance: "1000",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.streams[id] = stream;
  return stream;
}

describe("Concurrency and Idempotency Unit Tests", () => {
  beforeEach(() => {
    resetDb();
  });

  test("two concurrent pauses with the same Idempotency-Key produce one state change", async () => {
    seedActiveStream("s1");
    const key = "key-123";

    const [r1, r2] = await Promise.all([
      pauseHandler(makeReq(key), makeParams("s1")),
      pauseHandler(makeReq(key), makeParams("s1")),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    expect(db.streams["s1"].status).toBe("paused");
  });

  test("two concurrent pauses with different Idempotency-Keys: one succeeds, one gets 409", async () => {
    seedActiveStream("s1");

    const [r1, r2] = await Promise.all([
      pauseHandler(makeReq("key-A"), makeParams("s1")),
      pauseHandler(makeReq("key-B"), makeParams("s1")),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(db.streams["s1"].status).toBe("paused");
  });

  test("concurrent pause and start: one wins, one gets 409", async () => {
    seedActiveStream("s1");

    const [pauseRes, startRes] = await Promise.all([
      pauseHandler(makeReq("key-pause"), makeParams("s1")),
      startHandler(makeReq("key-start"), makeParams("s1")),
    ]);

    const statuses = [pauseRes.status, startRes.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  test("concurrent pause and stop: one wins, one gets 409", async () => {
    seedActiveStream("s1");

    const [pauseRes, stopRes] = await Promise.all([
      pauseHandler(makeReq("key-pause"), makeParams("s1")),
      stopHandler(makeReq("key-stop"), makeParams("s1")),
    ]);

    const statuses = [pauseRes.status, stopRes.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  test("concurrent pause and settle: one wins, one gets 409", async () => {
    seedActiveStream("s1");

    const [pauseRes, settleRes] = await Promise.all([
      pauseHandler(makeReq("key-pause"), makeParams("s1")),
      settleHandler(makeReq("key-settle"), makeParams("s1")),
    ]);

    const statuses = [pauseRes.status, settleRes.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  test("repeated pause with same Idempotency-Key does not mutate state twice", async () => {
    seedActiveStream("s1");
    const key = "key-repeat";

    const r1 = await pauseHandler(makeReq(key), makeParams("s1"));
    expect(r1.status).toBe(200);
    const firstUpdatedAt = db.streams["s1"].updatedAt;

    const r2 = await pauseHandler(makeReq(key), makeParams("s1"));
    expect(r2.status).toBe(200);
    expect(db.streams["s1"].updatedAt).toBe(firstUpdatedAt);
  });

  test("pause on stream requiring approval returns 202 and sets pendingApproval", async () => {
    const stream = seedActiveStream("s1");
    (stream as any).requiresApproval = true;

    const res = await pauseHandler(makeReq(), makeParams("s1"));
    expect(res.status).toBe(202);

    const body = await res.json();
    expect(body.approvalRequired).toBe(true);
  });

  test("pause after approval is granted transitions to paused", async () => {
    const stream = seedActiveStream("s1");
    (stream as any).requiresApproval = true;
    (stream as any).approvalGranted = true;

    const res = await pauseHandler(makeReq(), makeParams("s1"));
    expect(res.status).toBe(200);
    expect(db.streams["s1"].status).toBe("paused");
  });

  test("pause on non-existent stream returns 404", async () => {
    const res = await pauseHandler(makeReq(), makeParams("does-not-exist"));
    expect(res.status).toBe(404);
    const body = await res.json();
    const errorMessage = body.message || body.error || "";
    expect(errorMessage).toMatch(/not found/i);
  });

  test("pause on already-paused stream returns 409", async () => {
    const stream = seedActiveStream("s1");
    stream.status = "paused";

    const res = await pauseHandler(makeReq(), makeParams("s1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    const errorMessage = body.message || body.error || "";
    expect(errorMessage).toMatch(/paused/i);
  });

  test("pause on ended stream returns 409", async () => {
    const stream = seedActiveStream("s1");
    stream.status = "cancelled";

    const res = await pauseHandler(makeReq(), makeParams("s1"));
    expect(res.status).toBe(409);
    const body = await res.json();
    const errorMessage = body.message || body.error || "";
    expect(errorMessage).toMatch(/ended|cancelled/i);
  });

  test("N concurrent pauses without idempotency key: exactly one succeeds", async () => {
    seedActiveStream("s1");
    const N = 5;

    const promises = Array.from({ length: N }, () =>
      pauseHandler(makeReq(), makeParams("s1"))
    );

    const results = await Promise.all(promises);

    const successes = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(N - 1);
    expect(db.streams["s1"].status).toBe("paused");
  });
});
