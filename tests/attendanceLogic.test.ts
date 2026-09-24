import { describe, it, expect } from "vitest"
import { determineTahunAjaranSemester } from "@/services/absensiService"

describe("Attendance Semester & Academic Year Determination", () => {
    it("should classify July as Semester 1 of current/next year", () => {
        // Month index 6 = July
        const date = new Date(Date.UTC(2026, 6, 15))
        const result = determineTahunAjaranSemester(date)
        expect(result.semester).toBe(1)
        expect(result.tahunAjaran).toBe("2026/2027")
    })

    it("should classify December as Semester 1 of current/next year", () => {
        // Month index 11 = December
        const date = new Date(Date.UTC(2026, 11, 20))
        const result = determineTahunAjaranSemester(date)
        expect(result.semester).toBe(1)
        expect(result.tahunAjaran).toBe("2026/2027")
    })

    it("should classify January as Semester 2 of prev/current year", () => {
        // Month index 0 = January
        const date = new Date(Date.UTC(2027, 0, 10))
        const result = determineTahunAjaranSemester(date)
        expect(result.semester).toBe(2)
        expect(result.tahunAjaran).toBe("2026/2027")
    })

    it("should classify June as Semester 2 of prev/current year", () => {
        // Month index 5 = June
        const date = new Date(Date.UTC(2027, 5, 25))
        const result = determineTahunAjaranSemester(date)
        expect(result.semester).toBe(2)
        expect(result.tahunAjaran).toBe("2026/2027")
    })
})
