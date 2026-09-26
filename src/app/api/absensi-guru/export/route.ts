import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { SCHOOL_CALENDAR_2025_2026 } from "@/lib/schoolCalendar"
import ExcelJS from "exceljs"
import fs from "fs"
import path from "path"

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { tanggal, bulan, type } = await request.json()

        // 1. Fetch Users, Settings, & Wali Kelas Data
        const [teachersRaw, schoolSettings, waliKelasList] = await Promise.all([
            prisma.user.findMany({
                where: {
                    role: { in: ["guru", "guru_mapel", "kepsek", "admin"] },
                    username: { not: "admin" }
                },
                select: { id: true, name: true, role: true, kelas: true, nip: true },
            }),
            prisma.schoolSettings.findUnique({ where: { id: "main" } }),
            prisma.waliKelas.findMany()
        ])

        const kepsekUser = teachersRaw.find(t => t.role === "kepsek")
        const kepsekName = schoolSettings?.kepalaSekolah || kepsekUser?.name || "Kepala Sekolah"
        const kepsekNip = schoolSettings?.nipKepsek || kepsekUser?.nip || "-"

        // 2. Sort Logic (Kepala Sekolah selalu nomor 1 di atas secara dinamis)
        const PRIORITY_NAMES = [
            "Kuraesin",
            "Kurnia",
            "Endang",
            "Niken",
            "Ade",
            "Andris",
            "Yani",
            "Cecep",
            "Holid",
            "Sarah"
        ];

        const teachers = teachersRaw.sort((a, b) => {
            // Kepala Sekolah selalu di urutan paling atas tanpa bergantung pada nama orang
            const isKepsekA = a.role === "kepsek" || (schoolSettings?.kepalaSekolah && a.name.toLowerCase().includes(schoolSettings.kepalaSekolah.toLowerCase()))
            const isKepsekB = b.role === "kepsek" || (schoolSettings?.kepalaSekolah && b.name.toLowerCase().includes(schoolSettings.kepalaSekolah.toLowerCase()))
            if (isKepsekA && !isKepsekB) return -1
            if (!isKepsekA && isKepsekB) return 1

            const getIndex = (name: string) => {
                return PRIORITY_NAMES.findIndex(p =>
                    name.toLowerCase().includes(p.toLowerCase()) ||
                    p.toLowerCase().includes(name.toLowerCase())
                );
            };
            const indexA = getIndex(a.name);
            const indexB = getIndex(b.name);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.name.localeCompare(b.name);
        })

        const getNipLabel = (t: { name: string, role: string, kelas: number | null, nip?: string | null }) => {
            if (t.nip) return t.nip
            if (t.role === 'kepsek') return kepsekNip
            if (t.role === 'guru' && t.kelas) {
                const wk = waliKelasList.find(w => w.kelas === t.kelas)
                return wk?.nip || "-"
            }
            return "-"
        }

        const workbook = new ExcelJS.Workbook()
        let fileName = "";

        // Helper: Load Logo
        // Use process.cwd() to get the project root directory, works on Vercel
        const logoDir = path.join(process.cwd(), "public", "logo");
        const logoPemdaPath = path.join(logoDir, "LOGO-KABUPATEN-PURWAKARTA.png");
        const logoSekolahPath = path.join(logoDir, "Logo SDN 2 Nangerang.png");

        let logoPemdaId: number | null = null;
        let logoSekolahId: number | null = null;

        try {
            if (fs.existsSync(logoPemdaPath)) {
                logoPemdaId = workbook.addImage({
                    filename: logoPemdaPath,
                    extension: 'png',
                });
                console.log("Success load logo Pemda from", logoPemdaPath)
            } else {
                console.error("Logo Pemda not found at", logoPemdaPath)
            }

            if (fs.existsSync(logoSekolahPath)) {
                logoSekolahId = workbook.addImage({
                    filename: logoSekolahPath,
                    extension: 'png',
                });
                console.log("Success load logo Sekolah from", logoSekolahPath)
            } else {
                console.error("Logo Sekolah not found at", logoSekolahPath)
            }
        } catch (e) {
            console.error("Failed to load logos:", e);
        }

        // Helper to add logos to Sheet
        const addLogosToSheet = (worksheet: ExcelJS.Worksheet, rightCol: number) => {
            // rightCol is 1-based total columns count (e.g. 8)
            // We want to place logo at right, so index is rightCol - 1 (e.g. 7)

            if (logoPemdaId !== null) {
                worksheet.addImage(logoPemdaId, {
                    tl: { col: 0.2, row: 0.2 }, // Offset slightly inside A1
                    ext: { width: 60, height: 75 },
                    editAs: 'oneCell' // Anchor to cell A1 but free size
                });
            }
            if (logoSekolahId !== null) {
                // Place in the last column area
                worksheet.addImage(logoSekolahId, {
                    // Adjust horizontal offset to move it more to the right
                    // rightCol is base 1, so index is rightCol-1.
                    // Using rightCol - 0.8 moves it closer to the right edge than -1.2
                    tl: { col: rightCol - 0.7, row: 0.2 },
                    ext: { width: 75, height: 75 },
                    editAs: 'oneCell'
                });
            }
        }

        // Helper to Create Daily Sheet
        const createDailySheet = (dateObj: Date, attendanceData: any[]) => {
            const formattedDate = dateObj.toLocaleDateString("id-ID", {
                weekday: "long", day: "numeric", month: "long", year: "numeric"
            })
            const sheetName = dateObj.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })

            const worksheet = workbook.addWorksheet(sheetName, {
                pageSetup: {
                    orientation: 'landscape',
                    paperSize: 5, // Legal
                    fitToPage: true, // Force fit to page
                    fitToWidth: 1,
                    fitToHeight: 0, // Auto height
                    margins: {
                        left: 0.5, right: 0.5, top: 0.5, bottom: 0.5,
                        header: 0.3, footer: 0.3
                    }
                }
            })

            // Columns Setup - Adjusted for Legal Paper width (approx 14 inches printable?)
            // Increased widths to fill the space better
            worksheet.columns = [
                { width: 6 },  // No
                { width: 45 }, // Nama Guru (Wider)
                { width: 25 }, // NIP
                { width: 18 }, // Waktu Datang
                { width: 18 }, // Tanda Tangan
                { width: 18 }, // Waktu Pulang
                { width: 18 }, // Tanda Tangan
                { width: 15 }  // Ket
            ]

            // Title Rows
            const titles = [
                "PEMERINTAH KABUPATEN PURWAKARTA",
                "DINAS PENDIDIKAN",
                "SD NEGERI 2 NANGERANG",
                "Alamat: Kp. Peuntas Rt 08/03 Desa Nangerang Kec. Wanayasa Kab. Purwakarta 41174",
                "",
                "DAFTAR HADIR GURU",
                `Tanggal: ${formattedDate}`,
                ""
            ]

            titles.forEach((title, index) => {
                const row = worksheet.addRow([title])
                worksheet.mergeCells(row.number, 1, row.number, 8)
                row.font = { bold: true, size: 12, name: 'Arial' }
                row.alignment = { horizontal: 'center', vertical: 'middle' }

                if (index === 2) { // SD NEGERI...
                    row.font = { bold: true, size: 14, name: 'Arial' }
                }
                if (index === 3) { // Alamat
                    row.font = { bold: false, size: 9, name: 'Arial', italic: true }
                    // Move border here
                    row.getCell(1).border = { bottom: { style: 'double' } }
                }
                if (index === 5 || index === 6) { // Title Body
                    row.font = { bold: true, size: 12, name: 'Times New Roman' }
                }
            })

            // Add Logos
            addLogosToSheet(worksheet, 8); // Rightmost is col 8

            // Header Data
            const headerRow = worksheet.addRow(["No", "Nama Guru", "NIP", "Waktu Datang", "Tanda Tangan", "Waktu Pulang", "Tanda Tangan", "Ket"])
            headerRow.font = { bold: true, size: 12, name: 'Times New Roman' }
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0E0E0' }
                }
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                }
            })

            // Data Rows
            teachers.forEach((teacher, idx) => {
                const dateStr = dateObj.toISOString().split("T")[0]
                const att = attendanceData.find(a =>
                    a.userId === teacher.id &&
                    a.tanggal.toISOString().split("T")[0] === dateStr
                )

                const row = worksheet.addRow([
                    idx + 1,
                    teacher.name,
                    getNipLabel(teacher),
                    att?.waktuDatang || "",
                    att?.ttdDatang ? "✓" : "",
                    att?.waktuPulang || "",
                    att?.ttdPulang ? "✓" : "",
                    "" // Ket empty
                ])

                row.height = 25 // Increase row height for spacing
                row.font = { size: 12, name: 'Times New Roman' }

                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                    }
                    if (colNumber !== 2) { // Center all except Name
                        cell.alignment = { horizontal: 'center', vertical: 'middle' }
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' }
                    }
                })
            })

            // Signer
            worksheet.addRow([])
            worksheet.addRow([])

            const sheetDateStr = dateObj.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
            const dateRow = worksheet.addRow(["", "", "", "", "", `Wanayasa, ${sheetDateStr}`])
            worksheet.mergeCells(dateRow.number, 6, dateRow.number, 8)
            dateRow.getCell(6).alignment = { horizontal: 'center' }
            dateRow.getCell(6).font = { name: 'Times New Roman', size: 12 }

            const titleRow = worksheet.addRow(["", "", "", "", "", `Kepala ${schoolSettings?.namaSekolah || "Sekolah"}`])
            worksheet.mergeCells(titleRow.number, 6, titleRow.number, 8)
            titleRow.getCell(6).alignment = { horizontal: 'center' }
            titleRow.getCell(6).font = { name: 'Times New Roman', size: 12 }

            worksheet.addRow([])
            worksheet.addRow([])
            worksheet.addRow([])

            const nameRow = worksheet.addRow(["", "", "", "", "", kepsekName])
            worksheet.mergeCells(nameRow.number, 6, nameRow.number, 8)
            nameRow.getCell(6).alignment = { horizontal: 'center' }
            nameRow.getCell(6).font = { bold: true, underline: true, name: 'Times New Roman', size: 12 }

            const formattedNip = kepsekNip && kepsekNip !== "-" ? (kepsekNip.startsWith("NIP") ? kepsekNip : `NIP. ${kepsekNip}`) : "NIP. -"
            const nipRow = worksheet.addRow(["", "", "", "", "", formattedNip])
            worksheet.mergeCells(nipRow.number, 6, nipRow.number, 8)
            nipRow.getCell(6).alignment = { horizontal: 'center' }
            nipRow.getCell(6).font = { name: 'Times New Roman', size: 12 }
        }


        if (type === "daily" && tanggal) {
            const selectedDate = new Date(tanggal)
            const year = selectedDate.getFullYear()
            const month = selectedDate.getMonth()

            let startDate = new Date(year, month, 1)
            // Special Logic for Jan 2026
            if (year === 2026 && month === 0) {
                startDate = new Date(year, month, 12)
            }

            const attendance = await prisma.absensiGuru.findMany({
                where: {
                    tanggal: { gte: startDate, lte: selectedDate }
                }
            })

            const current = new Date(startDate)
            while (current <= selectedDate) {
                const day = current.getDay()
                // Manual date string for holiday check
                const y = current.getFullYear()
                const m = String(current.getMonth() + 1).padStart(2, '0')
                const d = String(current.getDate()).padStart(2, '0')
                const dateStr = `${y}-${m}-${d}`

                const isHoliday = SCHOOL_CALENDAR_2025_2026.holidays.includes(dateStr)

                if (day !== 0 && day !== 6 && !isHoliday) { // Skip Sunday & Saturday AND Holidays
                    createDailySheet(new Date(current), attendance)
                }
                current.setDate(current.getDate() + 1)
            }

            fileName = `absensi-harian-${tanggal}.xlsx`

        } else if (type === "monthly" && bulan) {
            const [year, month] = bulan.split("-").map(Number)
            const startDate = new Date(year, month - 1, 1)
            const endDate = new Date(year, month, 0)
            const daysInMonth = endDate.getDate()

            const attendance = await prisma.absensiGuru.findMany({
                where: { tanggal: { gte: startDate, lte: endDate } }
            })
            const monthName = startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })

            const worksheet = workbook.addWorksheet("Rekap Bulanan", {
                pageSetup: {
                    orientation: 'landscape',
                    paperSize: 5,
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: {
                        left: 0.5, right: 0.5, top: 0.5, bottom: 0.5,
                        header: 0.3, footer: 0.3
                    }
                }
            })

            // Columns Setup
            const cols = [{ width: 5 }, { width: 35 }]
            for (let d = 0; d < daysInMonth; d++) cols.push({ width: 4 })
            cols.push({ width: 10 })
            worksheet.columns = cols

            const totalCols = cols.length

            // Title Rows
            const titles = [
                "PEMERINTAH KABUPATEN PURWAKARTA",
                "DINAS PENDIDIKAN",
                "SD NEGERI 2 NANGERANG",
                "Alamat: Kp. Peuntas Rt 08/03 Desa Nangerang Kec. Wanayasa Kab. Purwakarta 41174",
                "",
                "REKAP KEHADIRAN GURU",
                `Bulan: ${monthName}`,
                ""
            ]

            titles.forEach((title, index) => {
                const row = worksheet.addRow([title])
                worksheet.mergeCells(row.number, 1, row.number, totalCols)
                row.font = { bold: true, size: 12, name: 'Arial' }
                row.alignment = { horizontal: 'center', vertical: 'middle' }

                if (index === 2) {
                    row.font = { bold: true, size: 14, name: 'Arial' }
                }
                if (index === 3) {
                    row.font = { bold: false, size: 9, name: 'Arial', italic: true }
                    row.getCell(1).border = { bottom: { style: 'double' } }
                }
                if (index === 5 || index === 6) {
                    row.font = { bold: true, size: 11, name: 'Arial' }
                }
            })

            // Add Logos
            addLogosToSheet(worksheet, totalCols);

            // Header Data
            const headerVals = ["No", "Nama Guru"]
            for (let d = 1; d <= daysInMonth; d++) headerVals.push(d.toString())
            headerVals.push("Jumlah")

            const headerRow = worksheet.addRow(headerVals)
            headerRow.font = { bold: true }
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
            headerRow.eachCell((cell, colNumber) => {
                let isHoliday = false
                if (colNumber > 2 && colNumber <= daysInMonth + 2) {
                    const day = colNumber - 2
                    // Use manual string construction to avoid timezone shifts from toISOString()
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                    const dateObj = new Date(year, month - 1, day)
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                    isHoliday = isWeekend || SCHOOL_CALENDAR_2025_2026.holidays.includes(dateStr)
                }

                if (isHoliday) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFD99694' } // Red, Accent 2, Lighter 40%
                    }
                    cell.font = {
                        bold: true,
                        color: { argb: 'FF000000' } // Black
                    }
                } else {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFE0E0E0' } // Gray
                    }
                }
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                }
            })

            // Teachers Data
            teachers.forEach((teacher, idx) => {
                const rowVals: (string | number)[] = [idx + 1, teacher.name]
                let hadirCount = 0
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
                    const att = attendance.find(a =>
                        a.userId === teacher.id &&
                        a.tanggal.toISOString().split("T")[0] === dateStr
                    )
                    if (att?.ttdDatang) {
                        rowVals.push("✓")
                        hadirCount++
                    } else {
                        rowVals.push("")
                    }
                }
                rowVals.push(hadirCount)
                const row = worksheet.addRow(rowVals)
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
                    }

                    if (colNumber > 2 && colNumber <= daysInMonth + 2) {
                        const day = colNumber - 2
                        // Use manual string construction to avoid timezone shifts from toISOString()
                        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                        const dateObj = new Date(year, month - 1, day)
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                        const isHoliday = isWeekend || SCHOOL_CALENDAR_2025_2026.holidays.includes(dateStr)

                        if (isHoliday) {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFD99694' } // Red, Accent 2, Lighter 40%
                            }
                            // Ensure text is black for readability if there's content
                            if (cell.value) {
                                cell.font = { color: { argb: 'FF000000' } }
                            }
                        }
                    }

                    if (colNumber !== 2) {
                        cell.alignment = { horizontal: 'center' }
                    } else {
                        cell.alignment = { horizontal: 'left' }
                    }
                })
            })

            // Signer for Monthly
            worksheet.addRow([])
            worksheet.addRow([])

            // Calculate signer position (right aligned)
            const signerWidth = 7 // spans
            const signerEndCol = totalCols - 1
            const signerStartCol = Math.max(1, signerEndCol - signerWidth + 1)

            const footerDateStr = startDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" })
            const dateRow = worksheet.addRow(new Array(totalCols).fill(""))
            dateRow.getCell(signerStartCol).value = `Wanayasa, ${footerDateStr}`
            worksheet.mergeCells(dateRow.number, signerStartCol, dateRow.number, signerEndCol)
            dateRow.getCell(signerStartCol).alignment = { horizontal: 'center' }
            dateRow.getCell(signerStartCol).font = { name: 'Times New Roman', size: 12 }

            const titleRow = worksheet.addRow(new Array(totalCols).fill(""))
            titleRow.getCell(signerStartCol).value = `Kepala SDN 2 Nangerang`
            worksheet.mergeCells(titleRow.number, signerStartCol, titleRow.number, signerEndCol)
            titleRow.getCell(signerStartCol).alignment = { horizontal: 'center' }
            titleRow.getCell(signerStartCol).font = { name: 'Times New Roman', size: 12 }

            worksheet.addRow([])
            worksheet.addRow([])
            worksheet.addRow([])

            const nameRow = worksheet.addRow(new Array(totalCols).fill(""))
            nameRow.getCell(signerStartCol).value = kepsekName
            worksheet.mergeCells(nameRow.number, signerStartCol, nameRow.number, signerEndCol)
            nameRow.getCell(signerStartCol).alignment = { horizontal: 'center' }
            nameRow.getCell(signerStartCol).font = { bold: true, underline: true, name: 'Times New Roman', size: 12 }

            const nipRow = worksheet.addRow(new Array(totalCols).fill(""))
            nipRow.getCell(signerStartCol).value = `NIP.${kepsekNip}`
            worksheet.mergeCells(nipRow.number, signerStartCol, nipRow.number, signerEndCol)
            nipRow.getCell(signerStartCol).alignment = { horizontal: 'center' }
            nipRow.getCell(signerStartCol).font = { name: 'Times New Roman', size: 12 }

        } else {
            return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
        }

        const buffer = await workbook.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`
            }
        })

    } catch (error) {
        console.error("Error exporting:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
