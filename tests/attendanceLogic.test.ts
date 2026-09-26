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

    it("should accurately compute attendance percentage based on elapsed recorded days rather than full month", () => {
        const totalSchoolDaysInMonth = 22
        const recordedDates = new Set(["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"])

        // Student A: attended all 5 recorded days
        const countsA = { H: 5, S: 0, I: 0, A: 0 }
        const totalRecordedA = countsA.H + countsA.S + countsA.I + countsA.A
        const baseDaysA = Math.max(Math.min(recordedDates.size, totalSchoolDaysInMonth), totalRecordedA)
        const percentageA = baseDaysA > 0 ? Math.min(100, Math.round((countsA.H / baseDaysA) * 100)) : 0
        expect(percentageA).toBe(100) // 100%, not 23%!

        // Student B: attended 4, sick 1
        const countsB = { H: 4, S: 1, I: 0, A: 0 }
        const totalRecordedB = countsB.H + countsB.S + countsB.I + countsB.A
        const baseDaysB = Math.max(Math.min(recordedDates.size, totalSchoolDaysInMonth), totalRecordedB)
        const percentageB = baseDaysB > 0 ? Math.min(100, Math.round((countsB.H / baseDaysB) * 100)) : 0
        expect(percentageB).toBe(80)

        // When 0 attendance has been taken yet
        const emptyRecordedDates = new Set<string>()
        const countsEmpty = { H: 0, S: 0, I: 0, A: 0 }
        const totalRecordedEmpty = 0
        const baseDaysEmpty = Math.max(Math.min(emptyRecordedDates.size, totalSchoolDaysInMonth), totalRecordedEmpty)
        const percentageEmpty = baseDaysEmpty > 0 ? Math.min(100, Math.round((countsEmpty.H / baseDaysEmpty) * 100)) : 0
        expect(percentageEmpty).toBe(0)
    })
})
