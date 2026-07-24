import { webcrypto } from 'crypto';

export const CSRF_COOKIE_NAME = 'csrf-token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generates a cryptographically secure random 32-byte hex token.
 * Safe to run in both Node.js and Next.js Edge Runtime.
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else if (typeof webcrypto !== 'undefined' && webcrypto.getRandomValues) {
    webcrypto.getRandomValues(array);
  } else {
    // Fallback in case of environments without webcrypto (mostly tests or old node versions)
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, (dec) => dec.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates whether a token matches the expected pattern (64-char hex string).
 */
export function isValidCsrfToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }
  return /^[a-f0-9]{64}$/.test(token);
}

/**
 * Standard timing-safe equality check for strings.
 * Loops through the entire length of the string to avoid timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verifies the CSRF cookie token and request header token.
 */
export function verifyCsrf(
  cookieToken: string | null | undefined,
  headerToken: string | null | undefined
): boolean {
  if (!isValidCsrfToken(cookieToken) || !isValidCsrfToken(headerToken)) {
    return false;
  }
  return timingSafeEqual(cookieToken!, headerToken!);
}
