import { describe, it, expect } from "vitest"
import { hitungTahunAjaranBaru, getDefaultAcademicYear, getAcademicYearOptions } from "@/lib/academicYear"

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

    it("should dynamically calculate default academic year based on date", () => {
        const defaultYear = getDefaultAcademicYear()
        expect(defaultYear).toMatch(/^\d{4}\/\d{4}$/)
    })

    it("should generate academic year options range and include active year", () => {
        const options = getAcademicYearOptions("2035/2036")
        expect(options.length).toBeGreaterThan(5)
        expect(options).toContain("2035/2036")
    })
})
