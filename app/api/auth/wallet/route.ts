import { NextResponse, NextRequest } from "next/server";
import { errorResponse, ErrorCode } from "@/app/lib/errors/server";
import { validateCsrfToken } from "@/app/lib/auth";
import { checkIpRateLimit, rateLimitResponse } from "@/lib/rateLimitIp";
import { getCorrelationContext, logger } from "@/app/lib/logger";
import {
  validateWalletChallengeQuery,
  validateWalletVerifyBody,
} from "@/app/lib/auth-wallet-validation";
import type { ValidationError } from "@/app/lib/stream-validation";

/** 422 envelope with per-field details, matching /api/streams. */
function validationErrorResponse(logMessage: string, errors: ValidationError[]) {
  logger.warn(logMessage, { errors });
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "One or more fields are invalid.",
        details: errors,
        request_id: getCorrelationContext()?.request_id,
      },
    },
    { status: 422 },
  );
}

/**
 * GET /api/auth/wallet
 * Issues a one-time challenge string for wallet-based authentication.
 * Rate-limited by IP (20 req/min) to prevent abuse of challenge generation.
 */
export async function GET(req: NextRequest) {
  const rateCheck = await checkIpRateLimit(req, "challenge");
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter!, req);
  }

  try {
    const address = req.nextUrl.searchParams.get("address");

    const validationErrors = validateWalletChallengeQuery({
      address: address ?? undefined,
    });
    if (validationErrors.length > 0) {
      return validationErrorResponse(
        "Wallet challenge validation failed",
        validationErrors,
      );
    }

    const challenge = `streampay_auth_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return NextResponse.json({ challenge, expires_at: expiresAt }, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.WALLET_CHALLENGE_FAILED,
      "Failed to generate wallet authentication challenge.",
      500,
    );
  }
}

/**
 * POST /api/auth/wallet
 * Verifies double-submit CSRF token and issues a bearer token.
 * Rate-limited by IP (5 req/min) to prevent brute-force login attempts.
 */
export async function POST(req: NextRequest) {
  // IP throttle for login (POST /api/auth/wallet) — 5 req/min per IP
  const rateCheck = await checkIpRateLimit(req, "login");
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.retryAfter!, req);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return validationErrorResponse("Wallet verify validation failed", [
        {
          field: "body",
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
        },
      ]);
    }

    const validationErrors = validateWalletVerifyBody(body);
    if (validationErrors.length > 0) {
      return validationErrorResponse(
        "Wallet verify validation failed",
        validationErrors,
      );
    }

    const { address, signature } = body as {
      address: string;
      challenge: string;
      signature: string;
    };

    const csrfCookie = req.cookies.get("csrf-token")?.value ?? null;
    const csrfHeader = req.headers.get("x-csrf-token");

    // Double-submit cookie check
    if (!validateCsrfToken(csrfCookie, csrfHeader)) {
      return errorResponse(
        ErrorCode.FORBIDDEN,
        "CSRF token mismatch.",
        403,
      );
    }

    const isValid = signature.length > 0;

    if (!isValid) {
      return errorResponse(
        ErrorCode.UNAUTHORIZED,
        "Signature verification failed.",
        401,
      );
    }

    const token = `tok_${Buffer.from(address).toString("base64url").slice(0, 24)}`;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({ token, expires_at: expiresAt }, { status: 200 });
  } catch {
    return errorResponse(
      ErrorCode.WALLET_VERIFY_FAILED,
      "Failed to verify wallet signature.",
      500,
    );
  }
}
