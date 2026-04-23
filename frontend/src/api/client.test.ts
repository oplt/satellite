import { describe, expect, it } from "vitest";

import { normalizeApiBase } from "./client";

describe("normalizeApiBase", () => {
    it("falls back to the default API base when unset", () => {
        expect(normalizeApiBase(undefined)).toBe("http://localhost:8000/api/v1");
    });

    it("appends /api/v1 when configured with the backend origin only", () => {
        expect(normalizeApiBase("http://localhost:8000")).toBe("http://localhost:8000/api/v1");
        expect(normalizeApiBase("http://localhost:8000/")).toBe("http://localhost:8000/api/v1");
    });

    it("extends /api to /api/v1", () => {
        expect(normalizeApiBase("http://localhost:8000/api")).toBe("http://localhost:8000/api/v1");
    });

    it("preserves an already-correct versioned API base", () => {
        expect(normalizeApiBase("http://localhost:8000/api/v1")).toBe("http://localhost:8000/api/v1");
    });

    it("leaves custom non-root paths unchanged", () => {
        expect(normalizeApiBase("http://localhost:8000/backend")).toBe("http://localhost:8000/backend");
    });
});
