import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rate limiter using in-memory store
 * For production, use Redis or similar distributed store
 */
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number }
>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: NextRequest) => string;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req) => req.headers.get("x-forwarded-for") || "unknown",
    message = "Too many requests, please try again later."
  } = options;

  return (req: NextRequest) => {
    const key = keyGenerator(req);
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return null; // Request allowed
    }

    if (record.count >= maxRequests) {
      return NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((record.resetTime - now) / 1000).toString()
          }
        }
      );
    }

    record.count++;
    return null; // Request allowed
  };
}

/**
 * File size validator middleware
 */
export function validateFileSize(
  maxSizeBytes: number,
  errorMessage: string = "File is too large"
) {
  return async (request: NextRequest) => {
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (bytes > maxSizeBytes) {
        return NextResponse.json(
          {
            error: `${errorMessage}. Maximum size is ${(maxSizeBytes / 1024 / 1024).toFixed(1)}MB.`
          },
          { status: 413 }
        );
      }
    }
    return null;
  };
}

/**
 * Clean old rate limit entries periodically
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
if (typeof global !== "undefined" && !("rateLimitCleanupInterval" in global)) {
  const interval = setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
  (global as any).rateLimitCleanupInterval = interval;
}
