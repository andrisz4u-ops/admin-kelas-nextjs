import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

const toRoman = (num: number) => {
    const roman = ["", "I", "II", "III", "IV", "V", "VI"]
    return roman[num] || String(num)
}

const getKelasWord = (num: number) => {
    const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam"]
    return words[num] || String(num)
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

        const isHarian = printMode === "HARIAN"
        const totalCols = isHarian ? 11 : 12

        const wb = new ExcelJS.Workbook()
        wb.creator = "Administrasi Guru SD"

        const ws = wb.addWorksheet("Agenda Mengajar", {
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

        // SubHeader Text
        const dCurrent = currentDate ? new Date(currentDate) : new Date()
        const dayName = DAY_NAMES_ID[dCurrent.getDay()] || "Senin"
        const fullDateText = dCurrent.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        })

        const subHeaderText = isHarian
            ? `HARI / TANGGAL : ${dayName.toUpperCase()}, ${fullDateText.toUpperCase()}`
            : printMode === "MINGGUAN"
                ? `PEKAN PEMBELAJARAN`
                : `BULAN : ${selectedMonth.toUpperCase()}`

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
        if (isHarian) {
            // Kolom Kelas dihilangkan karena sudah ada di identitas
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
            ws.mergeCells(9, 1, 10, 1)
            ws.getCell(9, 1).value = "NO"

            ws.mergeCells(9, 2, 10, 2)
            ws.getCell(9, 2).value = "HARI/TGL"

            ws.mergeCells(9, 3, 10, 3)
            ws.getCell(9, 3).value = "JAM PELAJARAN"

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

        // 4. Data Rows
        let curRow = 11
        printItems.forEach((item: any, idx: number) => {
            const d = new Date(item.tanggal)
            const dayStr = DAY_NAMES_ID[d.getDay()]
            const dateStr = d.toLocaleDateString("id-ID", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            })
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
            if (isHarian) {
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
                    `${dayStr}, ${dateStr}`,
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
            }

            for (let c = 1; c <= totalCols; c++) {
                const cell = ws.getCell(curRow, c)
                cell.border = thinBorder
                cell.font = { name: "Arial", size: 10 }

                if (isHarian) {
                    if (c === 1) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                    } else if (c === 2) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    } else if (c === 3) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    } else if (c === 4) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                    } else if (c >= 5 && c <= 7) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                    } else if (c === 8 || c === 9) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    } else if (c === 10) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                    } else if (c === 11) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    }
                } else {
                    if (c === 1) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                    } else if (c === 2) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                    } else if (c === 3) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    } else if (c === 4) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    } else if (c === 5) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                    } else if (c >= 6 && c <= 8) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                    } else if (c === 9 || c === 10) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    } else if (c === 11) {
                        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true }
                    } else if (c === 12) {
                        cell.alignment = { horizontal: "center", vertical: "middle" }
                        cell.font = { name: "Arial", size: 10, bold: true }
                    }
                }
            }

            curRow++
        })

        // 5. Signatures (Titi Mangsa) - DI-MERGE LEBAR AGAR NAMA & TANGGAL TIDAK TERPOTONG
        curRow += 2
        const sig1R = curRow
        const sig2R = curRow + 1
        const sigNameR = curRow + 5
        const sigNipR = curRow + 6

        const dateSignText = isHarian
            ? fullDateText
            : new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

        // Kolom tanda tangan kiri (Kepala Sekolah) di-merge dari Col 1 ke Col 4
        ws.mergeCells(sig1R, 1, sig1R, 4)
        ws.getCell(sig1R, 1).value = "Mengetahui,"
        ws.getCell(sig1R, 1).alignment = { horizontal: "center", vertical: "middle" }

        ws.mergeCells(sig2R, 1, sig2R, 4)
        ws.getCell(sig2R, 1).value = "Kepala Sekolah"
        ws.getCell(sig2R, 1).alignment = { horizontal: "center", vertical: "middle" }
        ws.getCell(sig2R, 1).font = { name: "Arial", size: 10, bold: true }

        const kepsekName = schoolSettings?.kepalaSekolah || "H. Ujang Ma'Mun, S.Pd.I."
        const kepsekNip = schoolSettings?.nipKepsek ? `NIP. ${schoolSettings.nipKepsek}` : "NIP. 196912122007011021"

        ws.mergeCells(sigNameR, 1, sigNameR, 4)
        ws.getCell(sigNameR, 1).value = kepsekName.toUpperCase()
        ws.getCell(sigNameR, 1).alignment = { horizontal: "center", vertical: "middle" }
        ws.getCell(sigNameR, 1).font = { name: "Arial", size: 10, bold: true, underline: true }

        ws.mergeCells(sigNipR, 1, sigNipR, 4)
        ws.getCell(sigNipR, 1).value = kepsekNip
        ws.getCell(sigNipR, 1).alignment = { horizontal: "center", vertical: "middle" }
        ws.getCell(sigNipR, 1).font = { name: "Arial", size: 9 }

        // Kolom tanda tangan kanan (Guru) di-merge dari Col 8 ke Col 11 (atau 9 ke 12 jika !isHarian)
        const rightStartCol = isHarian ? 8 : 9
        const rightEndCol = totalCols

        ws.mergeCells(sig1R, rightStartCol, sig1R, rightEndCol)
        ws.getCell(sig1R, rightStartCol).value = `Wanayasa, ${dateSignText}`
        ws.getCell(sig1R, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }

        ws.mergeCells(sig2R, rightStartCol, sig2R, rightEndCol)
        ws.getCell(sig2R, rightStartCol).value = isModePAI ? "Guru Mata Pelajaran PAI & BP" : `Guru Pengampu / Wali Kelas ${getKelasWord(kelas)} (${toRoman(kelas)})`
        ws.getCell(sig2R, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }
        ws.getCell(sig2R, rightStartCol).font = { name: "Arial", size: 10, bold: true }

        const guruNip = isModePAI ? "NIP. 196607101986102010" : (waliKelas?.nip && waliKelas.nip !== "-" ? `NIP. ${waliKelas.nip}` : "NIP. -")

        ws.mergeCells(sigNameR, rightStartCol, sigNameR, rightEndCol)
        ws.getCell(sigNameR, rightStartCol).value = teacherName.toUpperCase()
        ws.getCell(sigNameR, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }
        ws.getCell(sigNameR, rightStartCol).font = { name: "Arial", size: 10, bold: true, underline: true }

        ws.mergeCells(sigNipR, rightStartCol, sigNipR, rightEndCol)
        ws.getCell(sigNipR, rightStartCol).value = guruNip
        ws.getCell(sigNipR, rightStartCol).alignment = { horizontal: "center", vertical: "middle" }
        ws.getCell(sigNipR, rightStartCol).font = { name: "Arial", size: 9 }

        // Column widths
        if (isHarian) {
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
                { width: 18 }, // 2. HARI/TGL
                { width: 16 }, // 3. JAM
                { width: 24 }, // 4. MAPEL
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

        const buffer = await wb.xlsx.writeBuffer()
        const fileName = isHarian
            ? `Agenda_Mengajar_${isModePAI ? "PAIBP" : `Kelas_${kelas}`}_${currentDate}.xlsx`
            : `Agenda_Mengajar_${isModePAI ? "PAIBP" : `Kelas_${kelas}`}_${selectedMonth}.xlsx`

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
