import { describe, it, expect } from "vitest"
import { POST } from "../src/app/api/jurnal/export/route"
import { NextRequest } from "next/server"
import ExcelJS from "exceljs"

describe("Jurnal Export Multi-Sheet", () => {
    it("should export BULANAN with 1 sheet per active day and skip weekend (Sabtu & Minggu)", async () => {
        const payloadBulanan = {
            printMode: "BULANAN",
            kelas: 5,
            isModePAI: false,
            teacherName: "Andris Hadiansyah, S.Pd",
            schoolName: "SDN 2 Nangerang",
            selectedMonth: "9", // Oktober
            totalSiswa: 27,
            printItems: [
                { id: "1", tanggal: "2026-10-01", jamKe: "1-2", mapel: "Matematika", materi: "Pecahan", jmlHadir: 26, jmlSakit: 1 },
                { id: "2", tanggal: "2026-10-02", jamKe: "1-2", mapel: "Bahasa Indonesia", materi: "Teks Narasi", jmlHadir: 27 },
                { id: "3", tanggal: "2026-10-03", jamKe: "1-2", mapel: "Weekend", materi: "Libur Sabtu", jmlHadir: 27 },
                { id: "4", tanggal: "2026-10-04", jamKe: "1-2", mapel: "Weekend", materi: "Libur Minggu", jmlHadir: 27 },
                { id: "5", tanggal: "2026-10-05", jamKe: "1-2", mapel: "IPAS", materi: "Ekosistem", jmlHadir: 27 }
            ]
        }

        const req = new NextRequest("http://localhost:3001/api/jurnal/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadBulanan)
        })

        const res = await POST(req)
        expect(res.status).toBe(200)

        const arrayBuffer = await res.arrayBuffer()
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(Buffer.from(arrayBuffer) as any)

        const sheetNames = wb.worksheets.map(w => w.name)
        expect(sheetNames).toContain("1 Okt 2026")
        expect(sheetNames).toContain("2 Okt 2026")
        expect(sheetNames).toContain("5 Okt 2026")
        // Weekend must NOT be included
        expect(sheetNames).not.toContain("3 Okt 2026")
        expect(sheetNames).not.toContain("4 Okt 2026")

        // Check format of worksheet 1
        const ws1 = wb.getWorksheet("1 Okt 2026")!
        expect(ws1.getCell(1, 1).value).toBe("AGENDA MENGAJAR GURU")
        expect(ws1.getCell(2, 1).value).toBe("(JURNAL HARIAN)")
        expect(ws1.getCell(8, 1).value).toContain("HARI / TANGGAL :")
        expect(ws1.getCell(8, 1).value).toContain("OKTOBER 2026")
        expect(ws1.getCell(9, 1).value).toBe("NO")
        expect(ws1.getCell(9, 2).value).toBe("JAM PELAJARAN")
        expect(ws1.getCell(9, 3).value).toBe("MATA PELAJARAN")
        // Signatures (row 19 after min 6 rows)
        expect(ws1.getCell(19, 1).value).toBe("Mengetahui,")
        expect(ws1.getCell(20, 1).value).toBe("Kepala Sekolah")
    })

    it("should export MINGGUAN with 1 sheet per school day (Monday to Friday)", async () => {
        const payloadMingguan = {
            printMode: "MINGGUAN",
            kelas: 5,
            isModePAI: false,
            teacherName: "Andris Hadiansyah, S.Pd",
            schoolName: "SDN 2 Nangerang",
            currentDate: "2026-10-05", // Monday
            totalSiswa: 27,
            printItems: [
                { id: "10", tanggal: "2026-10-05", jamKe: "1-2", mapel: "Matematika", materi: "Pecahan Desimal", jmlHadir: 27 },
                { id: "11", tanggal: "2026-10-07", jamKe: "1-2", mapel: "Bahasa Sunda", materi: "Pupuh", jmlHadir: 27 }
            ]
        }

        const req = new NextRequest("http://localhost:3001/api/jurnal/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payloadMingguan)
        })

        const res = await POST(req)
        expect(res.status).toBe(200)

        const arrayBuffer = await res.arrayBuffer()
        const wb = new ExcelJS.Workbook()
        await wb.xlsx.load(Buffer.from(arrayBuffer) as any)

        const sheetNames = wb.worksheets.map(w => w.name)
        // Senin s.d. Jumat (5 Okt s.d. 9 Okt)
        expect(sheetNames).toContain("5 Okt 2026")
        expect(sheetNames).toContain("6 Okt 2026")
        expect(sheetNames).toContain("7 Okt 2026")
        expect(sheetNames).toContain("8 Okt 2026")
        expect(sheetNames).toContain("9 Okt 2026")
        // Weekend must not be present
        expect(sheetNames).not.toContain("10 Okt 2026")
        expect(sheetNames).not.toContain("11 Okt 2026")
    })
})
