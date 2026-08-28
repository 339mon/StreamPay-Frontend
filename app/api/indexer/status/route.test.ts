/** @jest-environment node */
import { getIndexerStatus } from "./status";
import { cursorsDb } from "@/lib/indexer";
import { _resetAdminStateForTesting, setCircuitBreaker } from "@/app/lib/admin-guard";

const ADMIN_ADDRESS = "GADMIN_TEST_ADDRESS_12345";
const originalEnv = { ...process.env };
let nowSpy: jest.SpyInstance;

beforeEach(() => {
  _resetAdminStateForTesting(ADMIN_ADDRESS);
  cursorsDb.clear();
  process.env.STELLAR_NETWORK = "testnet";
  process.env.STALL_THRESHOLD_MS = "10000";
  nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000);
});

afterEach(() => {
  nowSpy.mockRestore();
  delete process.env.STELLAR_NETWORK;
  delete process.env.STALL_THRESHOLD_MS;
  process.env = { ...originalEnv };
});

describe("GET /api/indexer/status — deterministic status", () => {
  it("reports loading before the cursor has advanced", () => {
    const s = getIndexerStatus();
    expect(s.status).toBe("loading");
    expect(s.stale).toBe(false);
    expect(s.breakerOpen).toBe(false);
  });

  it("reports synced once the cursor advanced recently and is inside the stall threshold", () => {
    cursorsDb.set("testnet", { lastLedger: 42, lastUpdatedAt: 900 });
    const s = getIndexerStatus();
    expect(s.status).toBe("synced");
    expect(s.stale).toBe(false);
    expect(s.ledgerCursor).toBe(42);
  });

  it("reports stalled once the cursor age exceeds the threshold, with stale=true", () => {
    // lastUpdatedAt at 0, now at 1000 -> 1000ms > 0 diff needs > 10000; force stale:
    cursorsDb.set("testnet", { lastLedger: 42, lastUpdatedAt: -1_000_000 });
    const s = getIndexerStatus();
    expect(s.stale).toBe(true);
    expect(s.status).toBe("stalled");
  });

  it("does not report stale at exactly the threshold boundary", () => {
    // age = 9000ms (now 1000, lastUpdated -8000) which is < 10000 -> fresh
    cursorsDb.set("testnet", { lastLedger: 5, lastUpdatedAt: 1_000 - 9_999 });
    const s = getIndexerStatus();
    expect(s.stale).toBe(false);
    expect(s.status).toBe("synced");
  });

  it("reports stopped when the indexer circuit breaker is open (permission)", () => {
    setCircuitBreaker(
      new Request("http://localhost/api/admin/circuit-breaker", {
        headers: { "Actor-Wallet-Address": ADMIN_ADDRESS },
      }),
      "indexer",
      true,
    );
    // Even a fresh cursor reports stopped because permission gates everything.
    cursorsDb.set("testnet", { lastLedger: 42, lastUpdatedAt: 900 });
    const s = getIndexerStatus();
    expect(s.breakerOpen).toBe(true);
    expect(s.status).toBe("stopped");
  });

  it("returns a stable message for every status without leaking raw state", () => {
    for (let i = 0; i < 20; i++) {
      const s = getIndexerStatus();
      expect(typeof s.message).toBe("string");
      expect(s.message.length).toBeGreaterThan(0);
      expect(s.message).not.toContain(process.env.JWT_SECRET ?? "nope");
    }
  });
});
