"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import * as XLSX from "xlsx-js-style"
import { SelectKelas, Button, Badge } from "@/components/ui"

interface RekapSiswa {
    id: string
    nis: string
    nama: string
    hadir: number
    sakit: number
    izin: number
    alpha: number
    totalRecorded: number
    totalSchoolDays: number
    percentage: number
    dailyLogs?: Record<string, string>
}

interface RekapMeta {
    startDate: string
    endDate: string
    totalSchoolDays: number
    holidaysInPeriod?: string[]
    type: string
    month?: number
    semester?: number
    year: number
    kelas: number
}

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

export default function RekapAbsensiPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [recap, setRecap] = useState<RekapSiswa[]>([])
    const [meta, setMeta] = useState<RekapMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const [kelas, setKelas] = useState(userKelas || 1)
    const [type, setType] = useState<"month" | "semester">("month")
    const [month, setMonth] = useState(new Date().getMonth())
    const [year, setYear] = useState(new Date().getFullYear())
    const [tahunAjaran, setTahunAjaran] = useState("2025/2026")
    const [semester, setSemester] = useState(1)

    useEffect(() => {
        fetch("/api/settings/school")
            .then(res => res.json())
            .then(data => {
                if (data?.tahunAjaran) setTahunAjaran(data.tahunAjaran)
                if (data?.semesterAktif) setSemester(Number(data.semesterAktif))
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const qKelas = params.get("kelas")
            if (qKelas && [1, 2, 3, 4, 5, 6].includes(Number(qKelas))) {
                setKelas(Number(qKelas))
                return
            }
        }
        if (!canSelectKelas && userKelas) {
            setKelas(userKelas)
        }
    }, [canSelectKelas, userKelas])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                kelas: kelas.toString(),
                type,
                month: month.toString(),
                year: year.toString(),
                semester: semester.toString(),
                tahunAjaran,
            })
            const res = await fetch(`/api/rekap/absensi?${params}`, { cache: "no-store" })
            const data = await res.json()
            setRecap(data.recap)
            setMeta(data.meta)
        } catch {
            toast.error("Gagal memuat data rekap")
        } finally {
            setLoading(false)
        }
    }, [kelas, type, month, year, semester, tahunAjaran])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleExport = () => {
        if (recap.length === 0 || !meta) {
            toast.error("Tidak ada data untuk diexport")
            return
        }

        const periodLabel = type === "month"
            ? `${monthNames[month]} ${year}`
            : `Semester ${semester} ${semester === 1 ? year : year - 1}/${year}`

        // Generate dynamic daily headers
        const start = new Date(meta.startDate)
        const end = new Date(meta.endDate)
        const dateHeaders: string[] = []
        const dateKeys: string[] = []

        const current = new Date(start)
        while (current <= end) {
            dateHeaders.push(current.getDate().toString())
            // Use local date components to avoid UTC shift
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

        const centerStyle = {
            alignment: { horizontal: "center", vertical: "center" }
        }

        const titleStyle = {
            font: { bold: true, sz: 14 },
            alignment: { horizontal: "center", vertical: "center" }
        }

        const wsData: any[][] = []
        let ws: any
        const summaryRowsStartOffset = 2 // Gap between tables

        // Helper to get cell ref
        const getRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c })

        if (type === "month") {
            // --- MONTHLY (DAILY) LAYOUT ---

            // 1. Matrix Headers (No, NIS, Nama, Dates...)
            const matrixHeaders = ["No", "NIS", "Nama Siswa", ...dateHeaders]

            // 2. Matrix Data (Rows with daily logs only)
            const matrixRows = recap.map((s, i) => {
                const dailyCells = dateKeys.map(dateKey => s.dailyLogs?.[dateKey] || "")
                return [i + 1, s.nis, s.nama, ...dailyCells]
            })

            // 3. Summary Section Construction (With Merges)
            const summaryColsMerge = 2 // Merge 2 date-columns for 1 summary-column (User requested change from 4 to 2)
            const rawSummaryStats = ["Hadir (H)", "Sakit (S)", "Izin (I)", "Alpha (A)", "Hari Efektif", "Persentase (%)"]

            // Build Header Row
            const finalSummaryHeaderRow = ["No", "NIS", "Nama Siswa"]
            rawSummaryStats.forEach(h => {
                finalSummaryHeaderRow.push(h)
                for (let k = 1; k < summaryColsMerge; k++) finalSummaryHeaderRow.push("")
            })

            // Build Data Rows
            const finalSummaryRows = recap.map((s, i) => {
                const row: any[] = [i + 1, s.nis, s.nama]
                const stats = [s.hadir, s.sakit, s.izin, s.alpha, s.totalSchoolDays, s.percentage + "%"]
                stats.forEach(val => {
                    row.push(val)
                    for (let k = 1; k < summaryColsMerge; k++) row.push("")
                })
                return row
            })

            // Build Row Structure
            wsData.push([`Rekap Absensi Kelas ${kelas}`]) // Row 0
            wsData.push([`Periode: ${periodLabel}`]) // Row 1
            wsData.push([]) // Row 2

            // Matrix Table
            wsData.push(matrixHeaders) // Row 3
            wsData.push(...matrixRows) // Row 4+

            // Spacer
            wsData.push([])
            wsData.push([])

            // Summary Table
            wsData.push(finalSummaryHeaderRow)
            wsData.push(...finalSummaryRows)

            ws = XLSX.utils.aoa_to_sheet(wsData)

            // --- Styling Month Layout ---

            // Merge Titles
            const totalWidth = 3 + dateHeaders.length
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: totalWidth - 1 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: totalWidth - 1 } }
            ]

            // Center Titles
            if (!ws['A1']) ws['A1'] = { v: `Rekap Absensi Kelas ${kelas}`, t: 's' }
            ws['A1'].s = titleStyle
            if (!ws['A2']) ws['A2'] = { v: `Periode: ${periodLabel}`, t: 's' }
            ws['A2'].s = { ...titleStyle, font: { bold: true, sz: 12 } }

            const matrixStartRow = 4 // Index 4 (Row 5 in Excel)
            const matrixEndRow = 3 + matrixRows.length // Index

            // Style Matrix Headers
            for (let C = 0; C < matrixHeaders.length; C++) {
                const ref = getRef(3, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                ws[ref].s = {
                    border: borderStyle,
                    fill: { fgColor: { rgb: "E0E0E0" } },
                    font: { bold: true },
                    alignment: { horizontal: "center", vertical: "center" }
                }
                // Highlight Headers (Weekends)
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

            // Style Matrix Data
            const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1")
            for (let R = matrixStartRow; R <= matrixEndRow; R++) { // matrixRows count based
                // Note: Loop bounds adjusted to match array length correctly
                const rowIdx = R - matrixStartRow
                const rowData = matrixRows[rowIdx]
                if (!rowData) continue

                for (let C = 0; C < matrixHeaders.length; C++) {
                    const ref = getRef(R, C)
                    if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                    ws[ref].s = { border: borderStyle }
                    if (C === 0 || C === 1 || C >= 3) ws[ref].s.alignment = { horizontal: "center" }

                    // Off Day Styling
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

            // --- Summary Table Merges & Styles ---
            const summaryHeaderRowIdx = matrixEndRow + 3
            const summaryStartRowIdx = summaryHeaderRowIdx + 1
            const summaryEndRowIdx = summaryHeaderRowIdx + finalSummaryRows.length

            // Apply Merges for Summary Table
            for (let R = summaryHeaderRowIdx; R <= summaryEndRowIdx; R++) {
                for (let i = 0; i < rawSummaryStats.length; i++) {
                    const startCol = 3 + (i * summaryColsMerge)
                    const endCol = startCol + summaryColsMerge - 1
                    ws['!merges'].push({ s: { r: R, c: startCol }, e: { r: R, c: endCol } })
                }
            }

            // Style Summary Table
            // Header
            for (let C = 0; C < finalSummaryHeaderRow.length; C++) {
                // Check if it's a "real" column (start of merge or No/NIS/Nama) or empty spacer
                // Actually we style ALL cells in the range to ensure borders appear correctly around merged cells
                const ref = getRef(summaryHeaderRowIdx, C)
                if (!ws[ref]) ws[ref] = { v: "", t: 's' } // Create empty if needed for border
                ws[ref].s = {
                    border: borderStyle,
                    fill: { fgColor: { rgb: "E0E0E0" } },
                    font: { bold: true },
                    alignment: { horizontal: "center", vertical: "center" }
                }
            }

            // Data
            for (let R = summaryStartRowIdx; R <= summaryEndRowIdx; R++) {
                for (let C = 0; C < finalSummaryHeaderRow.length; C++) {
                    const ref = getRef(R, C)
                    if (!ws[ref]) ws[ref] = { v: "", t: 's' }
                    ws[ref].s = { border: borderStyle }
                    ws[ref].s.alignment = { horizontal: "center", vertical: "center" }
                    if (C === 2) ws[ref].s.alignment = { horizontal: "left", vertical: "center" } // Nama align left
                }
            }

            // Col Widths
            ws["!cols"] = [
                { wch: 5 }, { wch: 12 }, { wch: 30 },
                ...dateHeaders.map(() => ({ wch: 4 }))
            ]

        } else {
            // --- SEMESTER (MONTHLY AGGREGATE) LAYOUT ---

            // 1. Identify Months in Range
            const startD = new Date(meta.startDate)
            const endD = new Date(meta.endDate)
            const monthsInSemester: { index: number, name: string, year: number }[] = []

            let currentM = new Date(startD)
            // Normalize to start of month
            currentM.setDate(1)

            while (currentM <= endD) {
                monthsInSemester.push({
                    index: currentM.getMonth(),
                    name: monthNames[currentM.getMonth()],
                    year: currentM.getFullYear()
                })
                currentM.setMonth(currentM.getMonth() + 1)
            }

            // 2. Headers
            // Row 3: Month Names (Merged 4 cols)
            // Row 4: H, S, I, A (Repeated)

            const monthHeaderRow: any[] = ["No", "NIS", "Nama Siswa"]
            const subHeaderRow: any[] = ["", "", ""] // Empty for No, NIS, Nama (will merge vertically)

            monthsInSemester.forEach(m => {
                monthHeaderRow.push(m.name)
                monthHeaderRow.push("", "", "") // Placeholders for merge
                subHeaderRow.push("H", "S", "I", "A")
            })

            // 3. Data Rows
            const semesterRows = recap.map((s, i) => {
                const rowData: any[] = [i + 1, s.nis, s.nama]

                monthsInSemester.forEach(m => {
                    // Aggregate for this month
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

            // 4. Summary Headers
            const summaryHeaders = ["No", "NIS", "Nama Siswa", "Hadir (H)", "Sakit (S)", "Izin (I)", "Alpha (A)", "Total Hari Efektif", "Persentase (%)"]
            const summaryRows = recap.map((s, i) => [
                i + 1, s.nis, s.nama, s.hadir, s.sakit, s.izin, s.alpha, s.totalSchoolDays, s.percentage
            ])

            // Build Row Structure
            wsData.push([`Rekap Absensi Kelas ${kelas}`]) // Row 0
            wsData.push([`Periode: ${periodLabel}`]) // Row 1
            wsData.push([]) // Row 2

            wsData.push(monthHeaderRow) // Row 3
            wsData.push(subHeaderRow) // Row 4
            wsData.push(...semesterRows) // Row 5+

            wsData.push([])
            wsData.push([])

            wsData.push(summaryHeaders)
            wsData.push(...summaryRows)

            ws = XLSX.utils.aoa_to_sheet(wsData)

            // --- Styling Semester Layout ---
            // Calculate Total Width
            // 3 (Fixed) + Months * 4
            const totalSemWidth = 3 + (monthsInSemester.length * 4)

            // Merges
            ws['!merges'] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: totalSemWidth - 1 } }, // Title
                { s: { r: 1, c: 0 }, e: { r: 1, c: totalSemWidth - 1 } }, // Period
                // Merge No, NIS, Nama Vertically (Row 3-4)
                { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
                { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
                { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
            ]

            // Merge Month Headers Horizontally
            monthsInSemester.forEach((_, idx) => {
                const startCol = 3 + (idx * 4)
                ws['!merges'].push({ s: { r: 3, c: startCol }, e: { r: 3, c: startCol + 3 } })
            })

            // Center Titles
            if (!ws['A1']) ws['A1'] = { v: `Rekap Absensi Kelas ${kelas}`, t: 's' }
            ws['A1'].s = titleStyle
            if (!ws['A2']) ws['A2'] = { v: `Periode: ${periodLabel}`, t: 's' }
            ws['A2'].s = { ...titleStyle, font: { bold: true, sz: 12 } }

            // Style Headers (Rows 3 & 4)
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
                        // Month Names - Maybe different color?
                        ws[ref].s.fill = { fgColor: { rgb: "D1E7DD" } } // Light green/blue
                    }
                }
            }

            // Style Data Rows
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

            // Style Summary
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

            // Col Widths
            const cols = [
                { wch: 5 }, { wch: 12 }, { wch: 30 }
            ]
            monthsInSemester.forEach(() => {
                cols.push({ wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 })
            })
            ws["!cols"] = cols

        }

        const wb = XLSX.utils.book_new()
        // Sheet Name based on period - Remove illegal chars : \ / ? * [ ]
        let sheetName = periodLabel.replace(/[\/\\\?\*\[\]\:]/g, "-")
        sheetName = sheetName.length > 30 ? sheetName.substring(0, 30) : sheetName

        XLSX.utils.book_append_sheet(wb, ws, sheetName)
        XLSX.writeFile(wb, `Rekap_Absensi_Kelas${kelas}_${sheetName}.xlsx`)
        toast.success("Excel berhasil didownload!")
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Rekapitulasi Kehadiran</h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        Berdasarkan Kalender Pendidikan Kab. Purwakarta (Tahun Ajaran {tahunAjaran})
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Class selector */}
                    <SelectKelas
                        value={kelas}
                        onChange={setKelas}
                        disabled={!canSelectKelas}
                    />

                    {/* Type selector */}
                    <div className="flex rounded-md border border-[var(--border)] overflow-hidden">
                        <button
                            onClick={() => setType("month")}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${type === "month" ? "bg-black text-white" : "bg-white text-[var(--foreground)] hover:bg-[var(--accents-1)]"}`}
                        >
                            Bulanan
                        </button>
                        <button
                            onClick={() => setType("semester")}
                            className={`px-3 py-2 text-sm font-medium transition-colors ${type === "semester" ? "bg-black text-white" : "bg-white text-[var(--foreground)] hover:bg-[var(--accents-1)]"}`}
                        >
                            Semester
                        </button>
                    </div>

                    {/* Period selector */}
                    {type === "month" ? (
                        <>
                            <div className="relative">
                                <select
                                    value={month}
                                    onChange={(e) => setMonth(Number(e.target.value))}
                                    className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                                >
                                    {monthNames.map((m, i) => (<option key={i} value={i}>{m}</option>))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={year}
                                    onChange={(e) => setYear(Number(e.target.value))}
                                    className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                                >
                                    {[2024, 2025, 2026, 2027].map((y) => (<option key={y} value={y}>{y}</option>))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="relative">
                                <select
                                    value={semester}
                                    onChange={(e) => setSemester(Number(e.target.value))}
                                    className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                                >
                                    <option value={1}>Semester 1</option>
                                    <option value={2}>Semester 2</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                            <div className="relative">
                                <select
                                    value={tahunAjaran}
                                    onChange={(e) => {
                                        const selectedTa = e.target.value
                                        setTahunAjaran(selectedTa)
                                        const endYear = parseInt(selectedTa.split("/")[1]) || 2026
                                        setYear(endYear)
                                    }}
                                    className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm text-[var(--foreground)] outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none font-medium"
                                >
                                    <option value="2024/2025">2024/2025</option>
                                    <option value="2025/2026">2025/2026</option>
                                    <option value="2026/2027">2026/2027</option>
                                    <option value="2027/2028">2027/2028</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--accents-5)]">
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Export button */}
                    <Button
                        onClick={handleExport}
                        variant="secondary"
                        size="sm"
                        className="bg-emerald-600! text-white! hover:bg-emerald-700! border-emerald-600!"
                        icon={
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                        }
                    >
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* Info Card */}
            {meta && (
                <div className="turbo-card p-4">
                    <div className="flex flex-wrap items-center gap-6 text-sm">
                        <div>
                            <span className="text-[var(--accents-5)]">Periode:</span>{" "}
                            <span className="font-medium text-[var(--foreground)]">
                                {formatDate(meta.startDate)} - {formatDate(meta.endDate)}
                            </span>
                        </div>
                        <div>
                            <span className="text-[var(--accents-5)]">Hari Efektif:</span>{" "}
                            <span className="font-bold text-emerald-600">{meta.totalSchoolDays} hari</span>
                        </div>
                        {meta.holidaysInPeriod && meta.holidaysInPeriod.length > 0 && (
                            <div>
                                <span className="text-[var(--accents-5)]">Hari Libur:</span>{" "}
                                <span className="font-bold text-red-600">{meta.holidaysInPeriod.length} hari</span>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-[var(--accents-4)] mt-2">
                        * Tidak termasuk Sabtu, Minggu, dan hari libur nasional/sekolah
                    </p>
                </div>
            )}

            {/* Table */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-12">No</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] w-24">NIS</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)]">Nama Siswa</th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />H
                                    </span>
                                </th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-amber-500" />S
                                    </span>
                                </th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-blue-500" />I
                                    </span>
                                </th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-16">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full bg-red-500" />A
                                    </span>
                                </th>
                                <th className="px-4 py-3 font-medium text-[var(--accents-5)] text-center w-24">Kehadiran</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {loading ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--accents-5)]">Memuat data...</td></tr>
                            ) : recap.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-[var(--accents-5)]">Belum ada data siswa</td></tr>
                            ) : (
                                recap.map((s, i) => (
                                    <tr key={s.id} className="hover:bg-[var(--accents-1)] transition-colors">
                                        <td className="px-4 py-3 text-[var(--accents-5)]">{i + 1}</td>
                                        <td className="px-4 py-3 text-[var(--foreground)] font-medium tabular-nums">{s.nis}</td>
                                        <td className="px-4 py-3 text-[var(--foreground)] font-medium">{s.nama}</td>
                                        <td className="px-4 py-3 text-center font-bold text-emerald-600 tabular-nums">{s.hadir}</td>
                                        <td className="px-4 py-3 text-center font-bold text-amber-600 tabular-nums">{s.sakit}</td>
                                        <td className="px-4 py-3 text-center font-bold text-blue-600 tabular-nums">{s.izin}</td>
                                        <td className="px-4 py-3 text-center font-bold text-red-600 tabular-nums">{s.alpha}</td>
                                        <td className="px-4 py-3 text-center">
                                            <Badge variant={s.percentage >= 90 ? "success" : s.percentage >= 75 ? "warning" : "danger"}>
                                                {s.percentage}%
                                            </Badge>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
