import { after, describe, it, expect } from "node:test";
import { safeLocalStorageGet, safeLocalStorageRemove, safeLocalStorageSet } from "../lib/storage.ts";

describe("storage resilience helpers", () => {
  const originalWindow = globalThis.window;

  it("stores and reads values when localStorage is available", () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          }
        }
      },
      configurable: true
    });

    expect(safeLocalStorageSet("demo", "value")).toBe(true);
    expect(safeLocalStorageGet("demo")).toBe("value");
    expect(safeLocalStorageRemove("demo")).toBe(true);
    expect(safeLocalStorageGet("demo", "fallback")).toBe("fallback");
  });

  it("falls back safely when localStorage throws", () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        localStorage: {
          getItem: () => {
            throw new Error("blocked");
          },
          setItem: () => {
            throw new Error("blocked");
          },
          removeItem: () => {
            throw new Error("blocked");
          }
        }
      },
      configurable: true
    });

    expect(safeLocalStorageSet("demo", "value")).toBe(false);
    expect(safeLocalStorageGet("demo", "fallback")).toBe("fallback");
    expect(safeLocalStorageRemove("demo")).toBe(false);
  });

  after(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      configurable: true
    });
  });
});
