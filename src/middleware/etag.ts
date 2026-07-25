import { createHash } from "crypto";

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortKeys((value as Record<string, unknown>)[key]);
        return accumulator;
      }, {});
  }

  return value;
}

export function createStrongEtag(value: unknown): string {
  const canonical = JSON.stringify(sortKeys(value));
  const hash = createHash("sha256").update(canonical).digest("hex");
  return `"${hash}"`;
}

function normaliseEtagToken(token: string): string {
  return token.trim().replace(/^W\//i, "");
}

export function isIfNoneMatchMatch(etag: string, ifNoneMatchHeader: string | null): boolean {
  if (!ifNoneMatchHeader) {
    return false;
  }

  const normalisedEtag = normaliseEtagToken(etag);
  return ifNoneMatchHeader
    .split(",")
    .map((token) => token.trim())
    .some((token) => {
      if (token === "*") {
        return true;
      }

      return normaliseEtagToken(token) === normalisedEtag;
    });
}

export function createCacheHeaders(etag: string): Record<string, string> {
  return {
    etag,
    "cache-control": "public, max-age=0, must-revalidate",
  };
}
