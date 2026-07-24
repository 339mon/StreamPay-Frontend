import { createHash } from "crypto";
import type { ActivityEvent, ExportJob, Stream, User } from "@/app/types/openapi";
import type { Org, Member } from "@/app/types/org";
import { createInMemoryPersistenceStore } from "@/app/lib/repositories/in-memory";
import {
  createPostgresPersistenceStore,
  POSTGRES_ROLLOUT_NOTES,
  POSTGRES_SCHEMA_SKETCH,
} from "@/app/lib/repositories/postgres";

export type { ExportJob };
export type ExportJobStatus = ExportJob["status"];

export interface ExportAuditRecord {
  id: string;
  exportId: string;
  type: "export.requested" | "export.downloaded" | "export.expired";
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface KeyValueStore<K, V> {
  readonly size: number;
  clear(): void;
  delete(key: K): boolean;
  entries(): IterableIterator<[K, V]>;
  forEach(callbackfn: (value: V, key: K) => void): void;
  get(key: K): V | undefined;
  has(key: K): boolean;
  set(key: K, value: V): void;
  values(): IterableIterator<V>;
}

export interface AppendOnlyStore<T> extends Iterable<T> {
  readonly length: number;
  clear(): void;
  push(value: T): number;
  some(predicate: (value: T, index: number, array: T[]) => boolean): boolean;
  toArray(): T[];
}

export interface StreamRepository {
  readonly activity: KeyValueStore<string, ActivityEvent>;
  readonly streams: KeyValueStore<string, Stream>;
  readonly users: KeyValueStore<string, User>;
  reset(): void;
  withLock<T>(id: string, callback: () => Promise<T>): Promise<T>;
}

export interface IdempotencyStore extends KeyValueStore<string, unknown> {
  reset(): void;
}

export interface ExportRepository {
  readonly audit: AppendOnlyStore<ExportAuditRecord>;
  readonly jobs: KeyValueStore<string, ExportJob>;
  readonly processing: KeyValueStore<string, Promise<void>>;
  reset(): void;
}

export interface PersistenceStore {
  readonly exportRepository: ExportRepository;
  readonly idempotencyStore: IdempotencyStore;
  readonly kind: "memory" | "postgres";
  readonly streamRepository: StreamRepository;
}

// ── Store Management ─────────────────────────────────────────────────────────

let activeStore: PersistenceStore = createInMemoryPersistenceStore();

export function getStore(): PersistenceStore {
  return activeStore;
}

export function setStore(store: PersistenceStore): void {
  activeStore = store;
}

export function createDefaultStore(): PersistenceStore {
  return createInMemoryPersistenceStore();
}

export function withLock<T>(id: string, callback: () => Promise<T>): Promise<T> {
  return getStore().streamRepository.withLock(id, callback);
}

export { createInMemoryPersistenceStore };

// ── Test & Idempotency Helpers ───────────────────────────────────────────────

export const IDEMPOTENCY_TTL_MS = 86_400_000; // 24 Hours

export interface IdempotencyEntry {
  fingerprint: string;
  status: number;
  body: unknown;
  expiresAt: number;
}

export type CheckIdempotencyResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; conflict: true }
  | null;

export function resetDb(): void {
  const store = getStore();
  if ("reset" in store.streamRepository && typeof store.streamRepository.reset === "function") {
    store.streamRepository.reset();
  }
  if ("reset" in store.exportRepository && typeof store.exportRepository.reset === "function") {
    store.exportRepository.reset();
  }
  if ("reset" in store.idempotencyStore && typeof store.idempotencyStore.reset === "function") {
    store.idempotencyStore.reset();
  }
  setStore(createInMemoryPersistenceStore());
}

export function computeFingerprint(
  method: string,
  path: string,
  body?: any
): string {
  let normalizedBody = "";
  if (body !== null && body !== undefined) {
    if (typeof body === "object") {
      const keys = Object.keys(body).sort();
      const obj: Record<string, any> = {};
      for (const k of keys) obj[k] = body[k];
      normalizedBody = JSON.stringify(obj);
    } else {
      normalizedBody = String(body);
    }
  }
  return createHash("sha256")
    .update(`${method.toUpperCase()}:${path}:${normalizedBody}`)
    .digest("hex");
}

export function idempotencyToken(scope: string, key: string): string {
  return `${scope}:${key}`;
}

export function checkIdempotency(
  store: KeyValueStore<string, unknown>,
  key: string,
  fingerprint: string
): CheckIdempotencyResult {
  const raw = store.get(key);
  if (!raw || typeof raw !== "object") {
    if (raw !== undefined) {
      store.delete(key);
    }
    return null;
  }

  const entry = raw as Partial<IdempotencyEntry>;

  if (typeof entry.expiresAt !== "number" || typeof entry.fingerprint !== "string") {
    store.delete(key);
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  if (entry.fingerprint !== fingerprint) {
    return { ok: false, conflict: true };
  }

  return { ok: true, status: entry.status ?? 200, body: entry.body };
}

export function setIdempotency(
  store: KeyValueStore<string, unknown>,
  key: string,
  fingerprint: string,
  status: number,
  body: unknown,
  ttlMs: number = IDEMPOTENCY_TTL_MS
): void {
  const entry: IdempotencyEntry = {
    fingerprint,
    status,
    body,
    expiresAt: Date.now() + ttlMs,
  };
  store.set(key, entry);
}

// ── Proxy Utilities ──────────────────────────────────────────────────────────

function createStoreProxy<T>(storeGetter: () => KeyValueStore<string, T>, extraProps?: Record<string, any>) {
  return new Proxy({} as any, {
    get(target, prop, receiver) {
      const store = storeGetter();
      if (extraProps && prop in extraProps) {
        return extraProps[prop as string];
      }
      if (prop in store || typeof (store as any)[prop] === "function") {
        const value = (store as any)[prop];
        if (typeof value === "function") {
          return value.bind(store);
        }
        return value;
      }
      if (typeof prop === "string") {
        return store.get(prop);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const store = storeGetter();
      if (typeof prop === "string") {
        store.set(prop, value);
        return true;
      }
      return Reflect.set(target, prop, value, receiver);
    },
    deleteProperty(target, prop) {
      const store = storeGetter();
      if (typeof prop === "string") {
        return store.delete(prop);
      }
      return false;
    },
    has(target, prop) {
      const store = storeGetter();
      if (typeof prop === "string") {
        return store.has(prop);
      }
      return false;
    },
    ownKeys() {
      const store = storeGetter();
      const keys: string[] = [];
      store.forEach((_, key) => {
        keys.push(key);
      });
      return keys;
    },
    getOwnPropertyDescriptor(target, prop) {
      const store = storeGetter();
      if (typeof prop === "string" && store.has(prop)) {
        return {
          value: store.get(prop),
          writable: true,
          enumerable: true,
          configurable: true,
        };
      }
      return undefined;
    },
  });
}

// ── Unified DB Export ────────────────────────────────────────────────────────

export const db = {
  streams: createStoreProxy(() => getStore().streamRepository.streams),
  activity: createStoreProxy(() => getStore().streamRepository.activity),
  idempotency: createStoreProxy(() => getStore().idempotencyStore),
  orgs: new Map<string, Org>([
    ["org-1", { id: "org-1", name: "StreamPay Org", ownerWallet: "GATODH2T75IVFB7MG6ZKKIFPWFNVJBXVPUMTYV5ANT2O2ZWL7GSDZWNRW" }]
  ]),
  members: new Map<string, Member>([
    ["org-1:GATODH2T75IVFB7MG6ZKKIFPWFNVJBXVPUMTYV5ANT2O2ZWL7GSDZWNRW", { orgId: "org-1", walletAddress: "GATODH2T75IVFB7MG6ZKKIFPWFNVJBXVPUMTYV5ANT2O2ZWL7GSDZWNRW", role: "owner" }]
  ]),
};
