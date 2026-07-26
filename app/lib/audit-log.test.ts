/** @jest-environment node */

import { AppendOnlyAuditLogStore } from "./audit-log";

describe("AppendOnlyAuditLogStore", () => {
  it("uses a 30-day retention window for new entries", () => {
    const store = new AppendOnlyAuditLogStore();

    const entry = store.append({
      action: "stream.settle",
      actor: { id: "ops-admin-1", role: "admin" },
      after: { status: "ended" },
      before: { status: "active" },
      requestId: "req-retention",
      target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
      timestamp: "2026-04-28T10:00:00.000Z",
    });

    const expectedRetention = new Date("2026-05-28T10:00:00.000Z").toISOString();
    expect(entry.retentionUntil).toBe(expectedRetention);
  });

  it("creates a tamper-evident hash chain and rejects mutation attempts", () => {
    const store = new AppendOnlyAuditLogStore();

    const first = store.append({
      action: "stream.settle",
      actor: { id: "ops-admin-1", role: "admin" },
      after: { status: "ended" },
      before: { status: "active" },
      requestId: "req-1",
      target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
      timestamp: "2026-04-28T10:00:00.000Z",
    });

    const second = store.append({
      action: "stream.withdraw",
      actor: { id: "ops-admin-1", role: "admin" },
      after: { status: "withdrawn" },
      before: { status: "ended" },
      requestId: "req-2",
      target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
      timestamp: "2026-04-28T10:05:00.000Z",
    });

    expect(second.prevHash).toBe(first.entryHash);
    expect(store.assertIntegrity()).toBe(true);
    expect(() => store.updateEntry(first.id, { action: "stream.stop.override" })).toThrow("AUDIT_LOG_APPEND_ONLY");
    expect(() => store.deleteEntry(second.id)).toThrow("AUDIT_LOG_APPEND_ONLY");
  });

  it("archives expired entries and restores them without breaking the hash chain", () => {
    const store = new AppendOnlyAuditLogStore();

    const first = store.append({
      action: "stream.settle",
      actor: { id: "ops-admin-1", role: "admin" },
      after: { status: "ended" },
      before: { status: "active" },
      requestId: "req-archive-1",
      target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
      timestamp: "2024-01-01T10:00:00.000Z",
    });

    const second = store.append({
      action: "stream.withdraw",
      actor: { id: "ops-admin-1", role: "admin" },
      after: { status: "withdrawn" },
      before: { status: "ended" },
      requestId: "req-archive-2",
      target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
      timestamp: "2024-01-02T10:00:00.000Z",
    });

    const archived = store.archiveExpiredEntries("2024-02-05T00:00:00.000Z");

    expect(archived).toHaveLength(2);
    expect(store.count()).toBe(0);
    expect(store.assertIntegrity()).toBe(true);

    const restored = store.restoreArchivedEntries();

    expect(restored).toHaveLength(2);
    expect(restored[0].entryHash).toBe(first.entryHash);
    expect(restored[1].prevHash).toBe(first.entryHash);
    expect(restored[1].entryHash).toBe(second.entryHash);
    expect(store.count()).toBe(2);
    expect(store.assertIntegrity()).toBe(true);
  });

  it("redacts target account labels in exports", () => {
    const store = new AppendOnlyAuditLogStore();

    store.append({
      action: "stream.stop.override",
      actor: { id: "support-1", role: "support" },
      after: { status: "ended" },
      before: { status: "draft" },
      requestId: "req-export",
      target: { account: "acct_sensitive_target", id: "stream-2", type: "stream" },
      timestamp: "2026-04-28T11:00:00.000Z",
    });

    const [row] = store.exportRows({ requestId: "req-export" });

    expect(row.redactedTargetAccount).toBe("acct***rget");
    expect(row.redactionPolicy).toBe("mask-target-account");
  });

  describe("deepArchive", () => {
    it("archives entries older than the cutoff timestamp", () => {
      const store = new AppendOnlyAuditLogStore();

      const oldEntry = store.append({
        action: "stream.settle",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "ended" },
        before: { status: "active" },
        requestId: "req-deep-1",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2025-01-01T10:00:00.000Z",
      });

      const recentEntry = store.append({
        action: "stream.withdraw",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "withdrawn" },
        before: { status: "ended" },
        requestId: "req-deep-2",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2026-06-01T10:00:00.000Z",
      });

      const result = store.deepArchive("2025-06-01T00:00:00.000Z");

      expect(result.archivedCount).toBe(1);
      expect(result.archivedEntryIds).toEqual([oldEntry.id]);
      expect(store.count()).toBe(1);
      expect(store.list()).toHaveLength(1);
      expect(store.list()[0].id).toBe(recentEntry.id);
    });

    it("preserves chain integrity after deep archive", () => {
      const store = new AppendOnlyAuditLogStore();

      store.append({
        action: "stream.create",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "draft" },
        requestId: "req-chain-1",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2025-01-01T10:00:00.000Z",
      });

      store.append({
        action: "stream.start",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "active" },
        before: { status: "draft" },
        requestId: "req-chain-2",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2025-06-01T10:00:00.000Z",
      });

      const recentEntry = store.append({
        action: "stream.settle",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "ended" },
        before: { status: "active" },
        requestId: "req-chain-3",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2026-06-01T10:00:00.000Z",
      });

      const result = store.deepArchive("2026-01-01T00:00:00.000Z");

      expect(result.chainIntactBefore).toBe(true);
      expect(result.chainIntactAfter).toBe(true);
      expect(store.assertIntegrity()).toBe(true);
      expect(store.list()).toHaveLength(1);
      expect(store.list()[0].id).toBe(recentEntry.id);
    });

    it("returns archived entries via getDeepArchivedEntries", () => {
      const store = new AppendOnlyAuditLogStore();

      const oldEntry = store.append({
        action: "stream.settle",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "ended" },
        before: { status: "active" },
        requestId: "req-get-1",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2025-01-01T10:00:00.000Z",
      });

      store.deepArchive("2025-06-01T00:00:00.000Z");

      const archived = store.getDeepArchivedEntries();
      expect(archived).toHaveLength(1);
      expect(archived[0].entry.id).toBe(oldEntry.id);
      expect(archived[0].entry.action).toBe("stream.settle");
      expect(archived[0].archivedAt).toBeDefined();
    });

    it("returns empty result when no entries match the cutoff", () => {
      const store = new AppendOnlyAuditLogStore();

      store.append({
        action: "stream.settle",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "ended" },
        before: { status: "active" },
        requestId: "req-empty-1",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2026-06-01T10:00:00.000Z",
      });

      const result = store.deepArchive("2025-01-01T00:00:00.000Z");

      expect(result.archivedCount).toBe(0);
      expect(result.archivedEntryIds).toEqual([]);
      expect(result.chainIntactAfter).toBe(true);
      expect(store.getDeepArchivedEntries()).toEqual([]);
    });

    it("archives entries from both active and soft-archived stores", () => {
      const store = new AppendOnlyAuditLogStore();

      const veryOldEntry = store.append({
        action: "stream.settle",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "ended" },
        before: { status: "active" },
        requestId: "req-both-1",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2024-01-01T10:00:00.000Z",
      });

      const oldEntry = store.append({
        action: "stream.withdraw",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "withdrawn" },
        before: { status: "ended" },
        requestId: "req-both-2",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2024-06-01T10:00:00.000Z",
      });

      const recentEntry = store.append({
        action: "stream.stop.override",
        actor: { id: "support-1", role: "support" },
        after: { status: "ended" },
        before: { status: "draft" },
        requestId: "req-both-3",
        target: { account: "acct_demo_001", id: "stream-2", type: "stream" },
        timestamp: "2026-06-01T10:00:00.000Z",
      });

      store.archiveExpiredEntries("2024-07-02T00:00:00.000Z");
      expect(store.count()).toBe(1);

      const result = store.deepArchive("2026-01-01T00:00:00.000Z");

      expect(result.archivedCount).toBe(2);
      expect(result.archivedEntryIds).toEqual(
        expect.arrayContaining([veryOldEntry.id, oldEntry.id]),
      );
      expect(store.count()).toBe(1);
      expect(store.list()[0].id).toBe(recentEntry.id);
      expect(store.assertIntegrity()).toBe(true);
    });

    it("throws on invalid cutoff timestamp", () => {
      const store = new AppendOnlyAuditLogStore();
      expect(() => store.deepArchive("not-a-date")).toThrow("INVALID_ARCHIVE_CUTOFF");
    });

    it("accumulates entries across multiple archive calls", () => {
      const store = new AppendOnlyAuditLogStore();

      const entry1 = store.append({
        action: "stream.settle",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "ended" },
        before: { status: "active" },
        requestId: "req-acc-1",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2025-01-01T10:00:00.000Z",
      });

      const entry2 = store.append({
        action: "stream.withdraw",
        actor: { id: "ops-admin-1", role: "admin" },
        after: { status: "withdrawn" },
        before: { status: "ended" },
        requestId: "req-acc-2",
        target: { account: "acct_demo_001", id: "stream-1", type: "stream" },
        timestamp: "2025-03-01T10:00:00.000Z",
      });

      store.deepArchive("2025-02-01T00:00:00.000Z");
      expect(store.getDeepArchivedEntries()).toHaveLength(1);

      store.deepArchive("2025-04-01T00:00:00.000Z");
      expect(store.getDeepArchivedEntries()).toHaveLength(2);
      expect(store.getDeepArchivedEntries().map((de) => de.entry.id)).toEqual([
        entry1.id,
        entry2.id,
      ]);
    });
  });
});
