import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { isHoliday, isWeekend } from "@/lib/schoolCalendar"
import { prisma } from "@/lib/prisma"

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]
const MONTH_NAMES_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const MONTH_NAMES_LONG = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
]

const toRoman = (num: number) => {
    const roman = ["", "I", "II", "III", "IV", "V", "VI"]
    return roman[num] || String(num)
}

const getKelasWord = (num: number) => {
    const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam"]
    return words[num] || String(num)
}

function getItemYMD(dStr: string): string {
    if (!dStr) return ""
    try {
        const d = new Date(dStr)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${day}`
    } catch {
        return dStr.split("T")[0] || ""
    }
}

// Urutan jam pelajaran kronologis
function parseJamKeOrder(jamKe: string): number {
    if (!jamKe) return 9999
    const str = jamKe.toLowerCase().trim()

    const timeMatch = str.match(/^(\d{1,2})[.:](\d{2})/)
    if (timeMatch) {
        const h = parseInt(timeMatch[1], 10)
        const m = parseInt(timeMatch[2], 10)
        return h * 100 + m
    }

    if (str.includes("literasi") || str.includes("pembiasaan")) return 625
    if (str.includes("upacara") || str.includes("senam")) return 700

    const periodMatch = str.match(/^(\d+)/)
    if (periodMatch) {
        return 1000 + parseInt(periodMatch[1], 10) * 10
    }

    return 9999
}

interface ExportOptions {
    kelas: number
    isModePAI: boolean
    subjectName: string
    teacherName: string
    schoolName: string
    totalSiswa: number
    schoolSettings: any
    waliKelas: any
}

// Render 1 Worksheet A4 Landscape Harian yang presisi
function renderDailyWorksheet(
    wb: ExcelJS.Workbook,
    sheetName: string,
    dateObj: Date,
    dayItems: any[],
    options: ExportOptions
) {
    const {
        kelas,
        isModePAI,
        subjectName,
        teacherName,
        schoolName,
        totalSiswa,
        schoolSettings,
        waliKelas
    } = options

    const totalCols = isModePAI ? 12 : 11

    // Pastikan nama sheet unik dan valid untuk Excel (maks 31 char, tanpa karakter khusus)
    let sanitizedName = sheetName.replace(/[/\\?*[\]:]/g, " ").trim().substring(0, 31)
    let uniqueSheetName = sanitizedName
    let counter = 1
    while (wb.getWorksheet(uniqueSheetName)) {
        const suffix = ` (${counter++})`
        uniqueSheetName = sanitizedName.substring(0, 31 - suffix.length) + suffix
    }

    const ws = wb.addWorksheet(uniqueSheetName, {
        pageSetup: {
            orientation: "landscape",
            paperSize: 9, // A4
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: {
                left: 0.4,
                right: 0.4,
                top: 0.5,
                bottom: 0.5,
                header: 0.3,
                footer: 0.3
            }
        }
    })

    // SubHeader Hari & Tanggal Lembar Ini
    const dayName = DAY_NAMES_ID[dateObj.getDay()] || "Senin"
    const fullDateText = dateObj.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric"
    })
    const subHeaderText = `HARI / TANGGAL : ${dayName.toUpperCase()}, ${fullDateText.toUpperCase()}`

    // 1. Title Rows (Row 1 & 2)
    ws.mergeCells(1, 1, 1, totalCols)
    const t1 = ws.getCell(1, 1)
    t1.value = "AGENDA MENGAJAR GURU"
    t1.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF000000" } }
    t1.alignment = { horizontal: "center", vertical: "middle" }

    ws.mergeCells(2, 1, 2, totalCols)
    const t2 = ws.getCell(2, 1)
    t2.value = "(JURNAL HARIAN)"
    t2.font = { name: "Arial", size: 12, bold: true, color: { argb: "FF000000" } }
    t2.alignment = { horizontal: "center", vertical: "middle" }

    // 2. Identitas Guru & Sekolah (Row 4, 5, 6)
    ws.getCell(4, 1).value = `Nama Guru      : ${teacherName}`
    ws.getCell(4, 1).font = { name: "Arial", size: 10, bold: true }

    ws.getCell(5, 1).value = `Nama Sekolah   : ${schoolName}`
    ws.getCell(5, 1).font = { name: "Arial", size: 10, bold: true }

    if (isModePAI || subjectName) {
        ws.getCell(6, 1).value = `Mata Pelajaran : ${subjectName || "Pendidikan Agama Islam & Budi Pekerti (Lintas Kelas)"}`
    } else {
        ws.getCell(6, 1).value = `Kelas          : ${getKelasWord(kelas)} (${toRoman(kelas)})`
    }
    ws.getCell(6, 1).font = { name: "Arial", size: 10, bold: true }

    // Subheader (Row 8)
    ws.getCell(8, 1).value = subHeaderText
    ws.getCell(8, 1).font = { name: "Arial", size: 10, bold: true }

    // 3. Table Headers (Row 9 & 10)
    if (!isModePAI) {
        // Mode Guru Kelas: 11 Kolom
        ws.mergeCells(9, 1, 10, 1)
        ws.getCell(9, 1).value = "NO"

        ws.mergeCells(9, 2, 10, 2)
        ws.getCell(9, 2).value = "JAM PELAJARAN"

        ws.mergeCells(9, 3, 10, 3)
        ws.getCell(9, 3).value = "MATA PELAJARAN"

        ws.mergeCells(9, 4, 10, 4)
        ws.getCell(9, 4).value = "MATERI AJAR"

        ws.mergeCells(9, 5, 9, 7)
        ws.getCell(9, 5).value = "KEHADIRAN SISWA"
        ws.getCell(10, 5).value = "S"
        ws.getCell(10, 6).value = "I"
        ws.getCell(10, 7).value = "A"

        ws.mergeCells(9, 8, 10, 8)
        ws.getCell(9, 8).value = "JML HADIR"

        ws.mergeCells(9, 9, 10, 9)
        ws.getCell(9, 9).value = "JML TDK HADIR"

        ws.mergeCells(9, 10, 10, 10)
        ws.getCell(9, 10).value = "KET"

        ws.mergeCells(9, 11, 10, 11)
        ws.getCell(9, 11).value = "PARAF"
    } else {
        // Mode Guru Mapel / PAI: 12 Kolom (dengan kolom KELAS)
        ws.mergeCells(9, 1, 10, 1)
        ws.getCell(9, 1).value = "NO"

        ws.mergeCells(9, 2, 10, 2)
        ws.getCell(9, 2).value = "JAM PELAJARAN"

        ws.mergeCells(9, 3, 10, 3)
        ws.getCell(9, 3).value = "KELAS"

        ws.mergeCells(9, 4, 10, 4)
        ws.getCell(9, 4).value = "MATA PELAJARAN"

        ws.mergeCells(9, 5, 10, 5)
        ws.getCell(9, 5).value = "MATERI AJAR"

        ws.mergeCells(9, 6, 9, 8)
        ws.getCell(9, 6).value = "KEHADIRAN SISWA"
        ws.getCell(10, 6).value = "S"
        ws.getCell(10, 7).value = "I"
        ws.getCell(10, 8).value = "A"

        ws.mergeCells(9, 9, 10, 9)
        ws.getCell(9, 9).value = "JML HADIR"

        ws.mergeCells(9, 10, 10, 10)
        ws.getCell(9, 10).value = "JML TDK HADIR"

        ws.mergeCells(9, 11, 10, 11)
        ws.getCell(9, 11).value = "KET"

        ws.mergeCells(9, 12, 10, 12)
        ws.getCell(9, 12).value = "PARAF"
    }

    const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF000000" } },
        bottom: { style: "thin", color: { argb: "FF000000" } },
        left: { style: "thin", color: { argb: "FF000000" } },
        right: { style: "thin", color: { argb: "FF000000" } },
    }

    for (let r = 9; r <= 10; r++) {
        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(r, c)
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDAE3F3" }
            }
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF000000" } }
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
            cell.border = thinBorder
        }
    }

    // 4. Data Rows (Urutkan jam pelajaran)
    const sortedItems = [...dayItems].sort((a, b) => parseJamKeOrder(a.jamKe) - parseJamKeOrder(b.jamKe))

    let curRow = 11
    sortedItems.forEach((item: any, idx: number) => {
        const s = item.jmlSakit || 0
        const i = item.jmlIzin || 0
        const a = item.jmlAlpha || 0
        const tdkHadir = item.jmlTdkHadir !== undefined && item.jmlTdkHadir !== null ? item.jmlTdkHadir : (s + i + a)
        const hadir = item.jmlHadir !== undefined && item.jmlHadir !== null ? item.jmlHadir : Math.max(0, totalSiswa - tdkHadir)

        let ketText = "-"
        if (item.siswaAbsen && item.catatan) {
            ketText = `${item.siswaAbsen} (Refleksi: ${item.catatan})`
        } else if (item.siswaAbsen) {
            ketText = item.siswaAbsen
        } else if (item.catatan) {
            ketText = item.catatan
        }

        const row = ws.getRow(curRow)
        if (!isModePAI) {
            row.values = [
                idx + 1,
                item.jamKe,
                item.mapel,
                item.materi,
                s > 0 ? s : "-",
                i > 0 ? i : "-",
                a > 0 ? a : "-",
                hadir,
                tdkHadir > 0 ? tdkHadir : "-",
                ketText,
                item.paraf || "✓"
            ]
        } else {
            row.values = [
                idx + 1,
                item.jamKe,
                toRoman(item.kelas || kelas),
                item.mapel,
                item.materi,
                s > 0 ? s : "-",
                i > 0 ? i : "-",
                a > 0 ? a : "-",
                hadir,
                tdkHadir > 0 ? tdkHadir : "-",
                ketText,
                item.paraf || "✓"
            ]
        }

        for (let c = 1; c <= totalCols; c++) {
            const cell = ws.getCell(curRow, c)
            cell.border = thinBorder
            cell.font = { name: "Arial", size: 10 }

            if (!isModePAI) {
                if (c === 1 || c === 2 || (c >= 5 && c <= 9) || c === 11) {
                    cell.alignment = { horizontal: "center", vertical: "middle" }
                    if (c === 2 || c === 8 || c === 9 || c === 11) {
                        cell.font = { name: "Arial", size: 10, bold: true }
                    }
                } else if (c === 3) {
                    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                    cell.font = { name: "Arial", size: 10, bold: true }
                } else {
                    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                }
            } else {
                if (c === 1 || c === 2 || c === 3 || (c >= 6 && c <= 10) || c === 12) {
                    cell.alignment = { horizontal: "center", vertical: "middle" }
                    if (c === 2 || c === 3 || c === 9 || c === 10 || c === 12) {
                        cell.font = { name: "Arial", size: 10, bold: true }
                    }
                } else if (c === 4) {
                    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                    cell.font = { name: "Arial", size: 10, bold: true }
                } else {
                    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                }
            }
        }

        curRow++
    })

    // Filler Rows jika data KBM pada hari tersebut kurang dari 6 baris (agar formulir simetris dan rapi)
    const minRows = 6
    if (sortedItems.length < minRows) {
        const remaining = minRows - sortedItems.length
        for (let e = 0; e < remaining; e++) {
            const row = ws.getRow(curRow)
            const emptyVals: any[] = [sortedItems.length + e + 1]
            for (let c = 2; c <= totalCols; c++) {
                emptyVals.push("")
            }
            row.values = emptyVals

            for (let c = 1; c <= totalCols; c++) {
                const cell = ws.getCell(curRow, c)
                cell.border = thinBorder
                cell.font = { name: "Arial", size: 10, color: { argb: "FF9E9E9E" } }
                cell.alignment = { horizontal: "center", vertical: "middle" }
            }
            curRow++
        }
    }

    // 5. Signatures (Titi Mangsa) - Tepat di bawah tabel hari tersebut
    curRow += 2
    const sig1R = curRow
    const sig2R = curRow + 1
    const sigNameR = curRow + 5
    const sigNipR = curRow + 6

    // TTD Kiri (Kepala Sekolah)
    ws.mergeCells(sig1R, 1, sig1R, 4)
    ws.getCell(sig1R, 1).value = "Mengetahui,"
    ws.getCell(sig1R, 1).alignment = { horizontal: "center", vertical: "middle" }

    ws.mergeCells(sig2R, 1, sig2R, 4)
    ws.getCell(sig2R, 1).value = "Kepala Sekolah"
    ws.getCell(sig2R, 1).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(sig2R, 1).font = { name: "Arial", size: 10, bold: true }

    const kepsekName = schoolSettings?.kepalaSekolah || "-"
    const kepsekNip = schoolSettings?.nipKepsek ? `NIP. ${schoolSettings.nipKepsek}` : "-"

    ws.mergeCells(sigNameR, 1, sigNameR, 4)
    ws.getCell(sigNameR, 1).value = kepsekName.toUpperCase()
    ws.getCell(sigNameR, 1).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(sigNameR, 1).font = { name: "Arial", size: 10, bold: true, underline: true }

    ws.mergeCells(sigNipR, 1, sigNipR, 4)
    ws.getCell(sigNipR, 1).value = kepsekNip
    ws.getCell(sigNipR, 1).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(sigNipR, 1).font = { name: "Arial", size: 9 }

    // TTD Kanan (Guru Pengampu / Wali Kelas)
    const rightStartCol = isModePAI ? 9 : 8
    const rightEndCol = totalCols

    ws.mergeCells(sig1R, rightStartCol, sig1R, rightEndCol)
    ws.getCell(sig1R, rightStartCol).value = `Wanayasa, ${fullDateText}`
    ws.getCell(sig1R, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }

    ws.mergeCells(sig2R, rightStartCol, sig2R, rightEndCol)
    ws.getCell(sig2R, rightStartCol).value = isModePAI ? "Guru Mata Pelajaran PAI & BP" : `Guru Pengampu / Wali Kelas ${getKelasWord(kelas)} (${toRoman(kelas)})`
    ws.getCell(sig2R, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(sig2R, rightStartCol).font = { name: "Arial", size: 10, bold: true }

    const guruNip = waliKelas?.nip && waliKelas.nip !== "-" ? `NIP. ${waliKelas.nip}` : "NIP. -"

    ws.mergeCells(sigNameR, rightStartCol, sigNameR, rightEndCol)
    ws.getCell(sigNameR, rightStartCol).value = teacherName.toUpperCase()
    ws.getCell(sigNameR, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(sigNameR, rightStartCol).font = { name: "Arial", size: 10, bold: true, underline: true }

    ws.mergeCells(sigNipR, rightStartCol, sigNipR, rightEndCol)
    ws.getCell(sigNipR, rightStartCol).value = guruNip
    ws.getCell(sigNipR, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }
    ws.getCell(sigNipR, rightStartCol).font = { name: "Arial", size: 9 }

    // Column widths
    if (!isModePAI) {
        ws.columns = [
            { width: 5 },  // 1. NO
            { width: 16 }, // 2. JAM
            { width: 25 }, // 3. MAPEL
            { width: 44 }, // 4. MATERI
            { width: 5 },  // 5. S
            { width: 5 },  // 6. I
            { width: 5 },  // 7. A
            { width: 11 }, // 8. HADIR
            { width: 13 }, // 9. TDK HADIR
            { width: 32 }, // 10. KET
            { width: 8 },  // 11. PARAF
        ]
    } else {
        ws.columns = [
            { width: 5 },  // 1. NO
            { width: 15 }, // 2. JAM
            { width: 9 },  // 3. KELAS
            { width: 22 }, // 4. MAPEL
            { width: 40 }, // 5. MATERI
            { width: 5 },  // 6. S
            { width: 5 },  // 7. I
            { width: 5 },  // 8. A
            { width: 11 }, // 9. HADIR
            { width: 13 }, // 10. TDK HADIR
            { width: 30 }, // 11. KET
            { width: 8 },  // 12. PARAF
        ]
    }

    // Row Heights
    ws.getRow(1).height = 24
    ws.getRow(2).height = 20
    ws.getRow(8).height = 20
    ws.getRow(9).height = 24
    ws.getRow(10).height = 20
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            printItems = [],
            printMode = "HARIAN",
            kelas = 5,
            isModePAI = false,
            subjectName = "",
            teacherName = "Andris Hadiansyah, S.Pd",
            schoolName = "SDN 2 Nangerang",
            currentDate = "",
            selectedMonth = "ALL",
            totalSiswa = 27,
            schoolSettings = null,
            waliKelas = null
        } = body

        if (!Array.isArray(printItems) || printItems.length === 0) {
            return NextResponse.json({ error: "Tidak ada data untuk diexport" }, { status: 400 })
        }

        let currentSchoolSettings = schoolSettings
        if (!currentSchoolSettings) {
            try {
                currentSchoolSettings = await prisma.schoolSettings.findFirst()
            } catch {
                currentSchoolSettings = null
            }
        }

        const wb = new ExcelJS.Workbook()
        wb.creator = "Administrasi Guru SD"

        const options: ExportOptions = {
            kelas,
            isModePAI,
            subjectName,
            teacherName: teacherName || waliKelas?.nama || "Guru Pengampu",
            schoolName: schoolName || currentSchoolSettings?.namaSekolah || "Sekolah",
            totalSiswa,
            schoolSettings: currentSchoolSettings,
            waliKelas
        }

        // Kelompokkan data per tanggal YYYY-MM-DD
        const itemsByDate = new Map<string, any[]>()
        for (const item of printItems) {
            const ymd = getItemYMD(item.tanggal)
            if (!ymd) continue
            if (!itemsByDate.has(ymd)) {
                itemsByDate.set(ymd, [])
            }
            itemsByDate.get(ymd)!.push(item)
        }

        // Tentukan daftar tanggal yang akan dibuatkan sheet
        const targetDates: string[] = []

        if (printMode === "HARIAN") {
            const harianDate = currentDate || Array.from(itemsByDate.keys())[0]
            if (harianDate) {
                targetDates.push(harianDate)
            }
        } else if (printMode === "MINGGUAN") {
            // Rentang Senin s.d. Jumat pada pekan tanggal terpilih
            const refDateStr = currentDate || Array.from(itemsByDate.keys())[0] || new Date().toISOString()
            const [y, m, d] = refDateStr.split("-").map(Number)
            const dt = new Date(y, m - 1, d)
            const dayOfWeek = dt.getDay()
            const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
            const mon = new Date(dt)
            mon.setDate(dt.getDate() + diffToMon)

            // Loop 5 hari (Senin s.d. Jumat). Sabtu & Minggu otomatis dikecualikan.
            for (let offset = 0; offset < 5; offset++) {
                const cur = new Date(mon)
                cur.setDate(mon.getDate() + offset)
                const ymd = getItemYMD(cur.toISOString())
                const hasItems = itemsByDate.has(ymd) && itemsByDate.get(ymd)!.length > 0

                // Lewati jika libur nasional/sekolah dan tidak ada catatan KBM
                if (!hasItems && isHoliday(cur)) {
                    continue
                }

                // Untuk Guru Mapel (PAI), jika tidak ada KBM pada hari itu, lewati
                if (isModePAI && !hasItems) {
                    continue
                }

                targetDates.push(ymd)
            }
        } else {
            // Mode BULANAN:
            // Ambil semua tanggal yang ada di printItems, filter keluar akhir pekan (Sabtu & Minggu)
            const uniqueYMDs = Array.from(itemsByDate.keys())

            // Urutkan tanggal secara kronologis (asc)
            uniqueYMDs.sort()

            for (const ymd of uniqueYMDs) {
                const [y, m, d] = ymd.split("-").map(Number)
                const dt = new Date(y, m - 1, d)

                // Skip hari Sabtu & Minggu (libur / "betah di imah")
                if (isWeekend(dt)) {
                    continue
                }

                targetDates.push(ymd)
            }
        }

        // Fallback: Jika targetDates kosong, buat dari tanggal currentDate atau hari ini
        if (targetDates.length === 0) {
            const fallbackYMD = currentDate || new Date().toISOString().split("T")[0]
            targetDates.push(fallbackYMD)
        }

        // Buat 1 Sheet per Hari
        for (const ymd of targetDates) {
            const [y, m, d] = ymd.split("-").map(Number)
            const dateObj = new Date(y, m - 1, d)

            // Format nama sheet: "1 Okt 2026", "2 Okt 2026", "5 Okt 2026"
            const sheetName = `${d} ${MONTH_NAMES_SHORT[dateObj.getMonth()]} ${dateObj.getFullYear()}`
            const dayItems = itemsByDate.get(ymd) || []

            renderDailyWorksheet(wb, sheetName, dateObj, dayItems, options)
        }

        const buffer = await wb.xlsx.writeBuffer()

        // Penamaan file yang rapi
        const fileSubject = isModePAI ? (subjectName || "PAIBP").replace(/\s+/g, "_") : `Kelas_${kelas}`
        let fileName = ""

        if (printMode === "HARIAN") {
            fileName = `Agenda_Mengajar_${fileSubject}_${currentDate}.xlsx`
        } else if (printMode === "MINGGUAN") {
            fileName = `Agenda_Mengajar_${fileSubject}_Pekan_${currentDate}.xlsx`
        } else {
            const monthLabel = selectedMonth === "ALL"
                ? "Semester"
                : (MONTH_NAMES_LONG[parseInt(selectedMonth)] || `Bulan_${selectedMonth}`)
            fileName = `Agenda_Mengajar_${fileSubject}_${monthLabel}.xlsx`
        }

        return new NextResponse(buffer as any, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`
            }
        })
    } catch (error) {
        console.error("Error export jurnal Excel:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
