import { describe, it, expect } from "vitest"
import { hitungTahunAjaranBaru } from "@/services/siswaService"

describe("Academic Year Utilities", () => {
    it("should correctly increment standard academic year", () => {
        expect(hitungTahunAjaranBaru("2024/2025")).toBe("2025/2026")
        expect(hitungTahunAjaranBaru("2025/2026")).toBe("2026/2027")
        expect(hitungTahunAjaranBaru("2026/2027")).toBe("2027/2028")
    })

    it("should handle invalid format by returning next year fallback", () => {
        const nextYear = new Date().getFullYear() + 1
        const expected = `${nextYear}/${nextYear + 1}`
        expect(hitungTahunAjaranBaru("invalid-year")).toBe(expected)
        expect(hitungTahunAjaranBaru("")).toBe(expected)
    })
})
