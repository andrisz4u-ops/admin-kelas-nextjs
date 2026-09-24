import { describe, it, expect } from "vitest"
import { rateLimit } from "@/lib/rateLimit"

describe("In-Memory Rate Limiter", () => {
    it("should allow requests under the limit", () => {
        const testId = `test-user-${Date.now()}`
        const opts = { intervalMs: 10000, maxRequests: 3 }

        const res1 = rateLimit(testId, opts)
        expect(res1.success).toBe(true)
        expect(res1.remaining).toBe(2)

        const res2 = rateLimit(testId, opts)
        expect(res2.success).toBe(true)
        expect(res2.remaining).toBe(1)

        const res3 = rateLimit(testId, opts)
        expect(res3.success).toBe(true)
        expect(res3.remaining).toBe(0)
    })

    it("should reject requests exceeding maxRequests", () => {
        const testId = `test-blocked-${Date.now()}`
        const opts = { intervalMs: 10000, maxRequests: 2 }

        rateLimit(testId, opts)
        rateLimit(testId, opts)

        const resBlocked = rateLimit(testId, opts)
        expect(resBlocked.success).toBe(false)
        expect(resBlocked.remaining).toBe(0)
    })
})
