import * as XLSX from "xlsx-js-style"
import toast from "react-hot-toast"
import { RekapSiswa, RekapMeta, MONTH_NAMES } from "./types"

export function exportRekapToExcel(params: {
    recap: RekapSiswa[]
    meta: RekapMeta | null
    type: "month" | "semester"
    month: number
    year: number
    semester: number
    kelas: number
}) {
    const { recap, meta, type, month, year, semester, kelas } = params

    if (recap.length === 0 || !meta) {
        toast.error("Tidak ada data untuk diexport")
        return
    }

    const periodLabel = type === "month"
        ? `${MONTH_NAMES[month]} ${year}`
        : `Semester ${semester} ${semester === 1 ? year : year - 1}/${year}`

    // Generate dynamic daily headers
    const start = new Date(meta.startDate)
    const end = new Date(meta.endDate)
    const dateHeaders: string[] = []
    const dateKeys: string[] = []

    const current = new Date(start)
    while (current <= end) {
        dateHeaders.push(current.getDate().toString())
        const y = current.getFullYear()
        const m = String(current.getMonth() + 1).padStart(2, '0')
        const d = String(current.getDate()).padStart(2, '0')
        dateKeys.push(`${y}-${m}-${d}`)
        current.setDate(current.getDate() + 1)
    }

    // Helper style objects
    const borderStyle = {
        top: { style: "thin", color: { rgb: "000000" } },
        bottom: { style: "thin", color: { rgb: "000000" } },
        left: { style: "thin", color: { rgb: "000000" } },
        right: { style: "thin", color: { rgb: "000000" } }
    }

    const titleStyle = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: "center", vertical: "center" }
    }

    const wsData: any[][] = []
    let ws: any

    const getRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c })

    if (type === "month") {
        // --- MONTHLY (DAILY) LAYOUT ---
        const matrixHeaders = ["No", "NIS", "Nama Siswa", ...dateHeaders]

        const matrixRows = recap.map((s, i) => {
            const dailyCells = dateKeys.map(dateKey => s.dailyLogs?.[dateKey] || "")
            return [i + 1, s.nis, s.nama, ...dailyCells]
        })

        const summaryColsMerge = 2
        const rawSummaryStats = ["Hadir (H)", "Sakit (S)", "Izin (I)", "Alpha (A)", "Hari Efektif", "Persentase (%)"]

        const finalSummaryHeaderRow = ["No", "NIS", "Nama Siswa"]
        rawSummaryStats.forEach(h => {
            finalSummaryHeaderRow.push(h)
            for (let k = 1; k < summaryColsMerge; k++) finalSummaryHeaderRow.push("")
        })

        const finalSummaryRows = recap.map((s, i) => {
            const row: any[] = [i + 1, s.nis, s.nama]
            const stats = [s.hadir, s.sakit, s.izin, s.alpha, s.totalSchoolDays, s.percentage + "%"]
            stats.forEach(val => {
                row.push(val)
                for (let k = 1; k < summaryColsMerge; k++) row.push("")
            })
            return row
        })

        wsData.push([`Rekap Absensi Kelas ${kelas}`])
        wsData.push([`Periode: ${periodLabel}`])
        wsData.push([])

        wsData.push(matrixHeaders)
        wsData.push(...matrixRows)

        wsData.push([])
        wsData.push([])

        wsData.push(finalSummaryHeaderRow)
        wsData.push(...finalSummaryRows)

        ws = XLSX.utils.aoa_to_sheet(wsData)

        const totalWidth = 3 + dateHeaders.length
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalWidth - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalWidth - 1 } }
        ]

        if (!ws['A1']) ws['A1'] = { v: `Rekap Absensi Kelas ${kelas}`, t: 's' }
        ws['A1'].s = titleStyle
        if (!ws['A2']) ws['A2'] = { v: `Periode: ${periodLabel}`, t: 's' }
        ws['A2'].s = { ...titleStyle, font: { bold: true, sz: 12 } }

        const matrixStartRow = 4
        const matrixEndRow = 3 + matrixRows.length

        for (let C = 0; C < matrixHeaders.length; C++) {
            const ref = getRef(3, C)
            if (!ws[ref]) ws[ref] = { v: "", t: 's' }
            ws[ref].s = {
                border: borderStyle,
                fill: { fgColor: { rgb: "E0E0E0" } },
                font: { bold: true },
                alignment: { horizontal: "center", vertical: "center" }
            }
            if (C >= 3) {
                const dateIndex = C - 3
                const dateStr = dateKeys[dateIndex]
                const dateDate = new Date(dateStr)
                const isWeekend = dateDate.getDay() === 0 || dateDate.getDay() === 6
                const isHoliday = meta.holidaysInPeriod && meta.holidaysInPeriod.includes(dateStr)
                if (isWeekend || isHoliday) {
                    ws[ref].s.fill = { fgColor: { rgb: "D99694" } }
                    ws[ref].s.font = { bold: true, color: { rgb: "000000" } }
                }
            }
        }

        for (let R = matrixStartRow; R <= matrixEndRow; R++) {
            const rowIdx = R - matrixStartRow
            const rowData = matrixRows[rowIdx]
            if (!rowData) continue

            for (let C = 0; C < matrixHeaders.length; C++) {
                const ref = getRef(R, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                ws[ref].s = { border: borderStyle }
                if (C === 0 || C === 1 || C >= 3) ws[ref].s.alignment = { horizontal: "center" }

                if (C >= 3) {
                    const dateIndex = C - 3
                    const dateStr = dateKeys[dateIndex]
                    const dateDate = new Date(dateStr)
                    const isWeekend = dateDate.getDay() === 0 || dateDate.getDay() === 6
                    const isHoliday = meta.holidaysInPeriod && meta.holidaysInPeriod.includes(dateStr)
                    if (isWeekend || isHoliday) {
                        ws[ref].v = "X"
                        ws[ref].s.fill = { fgColor: { rgb: "D99694" } }
                        ws[ref].s.font = { color: { rgb: "000000" }, bold: true }
                    }
                }
            }
        }

        const summaryHeaderRowIdx = matrixEndRow + 3
        const summaryStartRowIdx = summaryHeaderRowIdx + 1
        const summaryEndRowIdx = summaryHeaderRowIdx + finalSummaryRows.length

        for (let R = summaryHeaderRowIdx; R <= summaryEndRowIdx; R++) {
            for (let i = 0; i < rawSummaryStats.length; i++) {
                const startCol = 3 + (i * summaryColsMerge)
                const endCol = startCol + summaryColsMerge - 1
                ws['!merges'].push({ s: { r: R, c: startCol }, e: { r: R, c: endCol } })
            }
        }

        for (let C = 0; C < finalSummaryHeaderRow.length; C++) {
            const ref = getRef(summaryHeaderRowIdx, C)
            if (!ws[ref]) ws[ref] = { v: "", t: 's' }
            ws[ref].s = {
                border: borderStyle,
                fill: { fgColor: { rgb: "E0E0E0" } },
                font: { bold: true },
                alignment: { horizontal: "center", vertical: "center" }
            }
        }

        for (let R = summaryStartRowIdx; R <= summaryEndRowIdx; R++) {
            for (let C = 0; C < finalSummaryHeaderRow.length; C++) {
                const ref = getRef(R, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                ws[ref].s = { border: borderStyle }
                ws[ref].s.alignment = { horizontal: "center", vertical: "center" }
                if (C === 2) ws[ref].s.alignment = { horizontal: "left", vertical: "center" }
            }
        }

        ws["!cols"] = [
            { wch: 5 }, { wch: 12 }, { wch: 30 },
            ...dateHeaders.map(() => ({ wch: 4 }))
        ]

    } else {
        // --- SEMESTER LAYOUT ---
        const startD = new Date(meta.startDate)
        const endD = new Date(meta.endDate)
        const monthsInSemester: { index: number, name: string, year: number }[] = []

        let currentM = new Date(startD)
        currentM.setDate(1)

        while (currentM <= endD) {
            monthsInSemester.push({
                index: currentM.getMonth(),
                name: MONTH_NAMES[currentM.getMonth()],
                year: currentM.getFullYear()
            })
            currentM.setMonth(currentM.getMonth() + 1)
        }

        const monthHeaderRow: any[] = ["No", "NIS", "Nama Siswa"]
        const subHeaderRow: any[] = ["", "", ""]

        monthsInSemester.forEach(m => {
            monthHeaderRow.push(m.name)
            monthHeaderRow.push("", "", "")
            subHeaderRow.push("H", "S", "I", "A")
        })

        const semesterRows = recap.map((s, i) => {
            const rowData: any[] = [i + 1, s.nis, s.nama]
            monthsInSemester.forEach(m => {
                let h = 0, sk = 0, iz = 0, al = 0
                if (s.dailyLogs) {
                    for (const [dateStr, status] of Object.entries(s.dailyLogs)) {
                        const d = new Date(dateStr)
                        if (d.getMonth() === m.index && d.getFullYear() === m.year) {
                            if (status === 'H') h++
                            else if (status === 'S') sk++
                            else if (status === 'I') iz++
                            else if (status === 'A') al++
                        }
                    }
                }
                rowData.push(h, sk, iz, al)
            })
            return rowData
        })

        const summaryHeaders = ["No", "NIS", "Nama Siswa", "Hadir (H)", "Sakit (S)", "Izin (I)", "Alpha (A)", "Total Hari Efektif", "Persentase (%)"]
        const summaryRows = recap.map((s, i) => [
            i + 1, s.nis, s.nama, s.hadir, s.sakit, s.izin, s.alpha, s.totalSchoolDays, s.percentage
        ])

        wsData.push([`Rekap Absensi Kelas ${kelas}`])
        wsData.push([`Periode: ${periodLabel}`])
        wsData.push([])

        wsData.push(monthHeaderRow)
        wsData.push(subHeaderRow)
        wsData.push(...semesterRows)

        wsData.push([])
        wsData.push([])

        wsData.push(summaryHeaders)
        wsData.push(...summaryRows)

        ws = XLSX.utils.aoa_to_sheet(wsData)

        const totalSemWidth = 3 + (monthsInSemester.length * 4)

        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: totalSemWidth - 1 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: totalSemWidth - 1 } },
            { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
            { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
            { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
        ]

        monthsInSemester.forEach((_, idx) => {
            const startCol = 3 + (idx * 4)
            ws['!merges'].push({ s: { r: 3, c: startCol }, e: { r: 3, c: startCol + 3 } })
        })

        if (!ws['A1']) ws['A1'] = { v: `Rekap Absensi Kelas ${kelas}`, t: 's' }
        ws['A1'].s = titleStyle
        if (!ws['A2']) ws['A2'] = { v: `Periode: ${periodLabel}`, t: 's' }
        ws['A2'].s = { ...titleStyle, font: { bold: true, sz: 12 } }

        for (let R = 3; R <= 4; R++) {
            for (let C = 0; C < totalSemWidth; C++) {
                const ref = getRef(R, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                ws[ref].s = {
                    border: borderStyle,
                    fill: { fgColor: { rgb: "E0E0E0" } },
                    font: { bold: true },
                    alignment: { horizontal: "center", vertical: "center" }
                }
                if (R === 3 && C >= 3) {
                    ws[ref].s.fill = { fgColor: { rgb: "D1E7DD" } }
                }
            }
        }

        const semRowsStart = 5
        const semRowsEnd = 4 + semesterRows.length

        for (let R = semRowsStart; R <= semRowsEnd; R++) {
            for (let C = 0; C < totalSemWidth; C++) {
                const ref = getRef(R, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                ws[ref].s = { border: borderStyle }
                if (C === 0 || C === 1 || C >= 3) ws[ref].s.alignment = { horizontal: "center" }
            }
        }

        const sumStartIndex = semRowsEnd + 3
        const sumStartRow = sumStartIndex + 1
        const sumEndRow = sumStartIndex + summaryRows.length

        for (let C = 0; C < summaryHeaders.length; C++) {
            const ref = getRef(sumStartIndex, C)
            if (!ws[ref]) ws[ref] = { v: "", t: 's' }
            ws[ref].s = {
                border: borderStyle,
                fill: { fgColor: { rgb: "E0E0E0" } },
                font: { bold: true },
                alignment: { horizontal: "center", vertical: "center" }
            }
        }
        for (let R = sumStartRow; R <= sumEndRow; R++) {
            for (let C = 0; C < summaryHeaders.length; C++) {
                const ref = getRef(R, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                ws[ref].s = { border: borderStyle }
                if (C !== 2) ws[ref].s.alignment = { horizontal: "center" }
            }
        }

        const cols = [
            { wch: 5 }, { wch: 12 }, { wch: 30 }
        ]
        monthsInSemester.forEach(() => {
            cols.push({ wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 })
        })
        ws["!cols"] = cols
    }

    const wb = XLSX.utils.book_new()
    let sheetName = periodLabel.replace(/[\/\\\?\*\[\]\:]/g, "-")
    sheetName = sheetName.length > 30 ? sheetName.substring(0, 30) : sheetName

    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `Rekap_Absensi_Kelas${kelas}_${sheetName}.xlsx`)
    toast.success("Excel berhasil didownload!")
}
