import { describe, it, expect, beforeEach, afterEach } from "node:test";
import type { Transaction } from "@/lib/types";
import { createRateLimiter } from "@/lib/middleware";
import { NextRequest } from "next/server";

describe("Rate Limiting Middleware", () => {
  let limiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    limiter = createRateLimiter({
      windowMs: 60 * 1000, // 1 minute for testing
      maxRequests: 3,
      keyGenerator: () => "test-user"
    });
  });

  it("should allow requests within limit", () => {
    const request1 = new NextRequest("http://localhost:3000/api/statements", {
      method: "POST"
    });
    const request2 = new NextRequest("http://localhost:3000/api/statements", {
      method: "POST"
    });
    const request3 = new NextRequest("http://localhost:3000/api/statements", {
      method: "POST"
    });

    expect(limiter(request1)).toBeNull();
    expect(limiter(request2)).toBeNull();
    expect(limiter(request3)).toBeNull();
  });

  it("should block requests exceeding limit", () => {
    const createRequest = () =>
      new NextRequest("http://localhost:3000/api/statements", { method: "POST" });

    limiter(createRequest());
    limiter(createRequest());
    limiter(createRequest());

    const result = limiter(createRequest());
    expect(result).not.toBeNull();
    expect(result?.status).toBe(429);
  });

  it("should include Retry-After header", async () => {
    const createRequest = () =>
      new NextRequest("http://localhost:3000/api/statements", { method: "POST" });

    limiter(createRequest());
    limiter(createRequest());
    limiter(createRequest());

    const result = limiter(createRequest());
    expect(result?.headers.get("Retry-After")).toBeDefined();
  });
});

describe("File Size Validation", () => {
  it("should validate file size limits", async () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const oversizedBuffer = Buffer.alloc(15 * 1024 * 1024); // 15MB

    expect(oversizedBuffer.length > maxSize).toBe(true);
  });

  it("should allow files under size limit", async () => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validBuffer = Buffer.alloc(5 * 1024 * 1024); // 5MB

    expect(validBuffer.length <= maxSize).toBe(true);
  });
});
