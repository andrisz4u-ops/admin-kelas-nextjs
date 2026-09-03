import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import ExcelJS from "exceljs"
import path from "path"
import fs from "fs/promises"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const kelas = searchParams.get("kelas")

    if (!kelas) return NextResponse.json({ error: "Kelas is required" }, { status: 400 })

    try {
        const schedule = await prisma.jadwalPelajaran.findMany({
            where: { kelas: Number(kelas) },
        })

        /*
                // Read logo
                const logoPath = path.join(process.cwd(), "public", "logo-sekolah.png")
                let logoBuffer: Buffer | null = null
                try {
                    logoBuffer = await fs.readFile(logoPath)
                } catch (e) {
                    console.error("Logo not found", e)
                }
        */
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet(`Jadwal Kelas ${kelas}`)

        // Add Header (Kop)
        // Merge A1:G1 for School Name
        ws.mergeCells('A1:G1')
        const titleRow = ws.getCell('A1')
        titleRow.value = "PEMERINTAH KABUPATEN PURWAKARTA"
        titleRow.alignment = { vertical: 'middle', horizontal: 'center' }
        titleRow.font = { name: 'Arial', size: 12, bold: true }

        ws.mergeCells('A2:G2')
        const subTitleRow = ws.getCell('A2')
        subTitleRow.value = "DINAS PENDIDIKAN"
        subTitleRow.alignment = { vertical: 'middle', horizontal: 'center' }
        subTitleRow.font = { name: 'Arial', size: 12, bold: true }

        ws.mergeCells('A3:G3')
        const schoolRow = ws.getCell('A3')
        schoolRow.value = "SD NEGERI 2 NANGERANG"
        schoolRow.alignment = { vertical: 'middle', horizontal: 'center' }
        schoolRow.font = { name: 'Arial', size: 14, bold: true }

        ws.mergeCells('A4:G4')
        const addressRow = ws.getCell('A4')
        addressRow.value = "Alamat: Kp. Nangerang RT 12 RW 06 Desa Nangerang, Kec. Wanayasa, Kab. Purwakarta 41174"
        addressRow.alignment = { vertical: 'middle', horizontal: 'center' }
        addressRow.font = { name: 'Arial', size: 9, italic: true }

        // Separator line
        ws.mergeCells('A5:G5')
        const separator = ws.getCell('A5')
        separator.border = { bottom: { style: 'thick' } }

        // Start Table at Row 7
        const TABLE_START_ROW = 7

        // Add Logo if exists
        /*
                if (logoBuffer) {
                    const logoId = wb.addImage({
                        buffer: logoBuffer as any,
                        extension: 'png',
                    })
                    // Position logo at top left (approximate)
                    ws.addImage(logoId, {
                        tl: { col: 0.2, row: 0.2 },
                        ext: { width: 80, height: 80 }
                    })
                }
        */

        // Title for the Schedule
        ws.mergeCells(`A${TABLE_START_ROW}:G${TABLE_START_ROW}`)
        const scheduleTitle = ws.getCell(`A${TABLE_START_ROW}`)
        scheduleTitle.value = `JADWAL PELAJARAN KELAS ${kelas}`
        scheduleTitle.alignment = { vertical: 'middle', horizontal: 'center' }
        scheduleTitle.font = { name: 'Arial', size: 12, bold: true }

        const HEADER_ROW = TABLE_START_ROW + 2

        // Setup Columns
        ws.getColumn('A').width = 5   // No
        ws.getColumn('B').width = 15  // Waktu
        ws.getColumn('C').width = 20  // Senin
        ws.getColumn('D').width = 20  // Selasa
        ws.getColumn('E').width = 20  // Rabu
        ws.getColumn('F').width = 20  // Kamis
        ws.getColumn('G').width = 20  // Jumat

        // Header Row
        const headerRow = ws.getRow(HEADER_ROW)
        headerRow.values = ['NO', 'WAKTU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT']

        // Styling
        const centerStyle: Partial<ExcelJS.Style> = { alignment: { vertical: 'middle', horizontal: 'center', wrapText: true } }
        const headerStyle: Partial<ExcelJS.Style> = {
            font: { bold: true, size: 11 },
            alignment: { vertical: 'middle', horizontal: 'center' },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEEE' } },
            border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
        }

        headerRow.eachCell((cell) => {
            cell.style = headerStyle
        })

        // Defined PRESET_TIMES to match frontend
        const PRESET_TIMES = [
            { jam: 0, waktu: "06.25 - 07.00" },
            { jam: 1, waktu: "07.00 - 07.35" },
            { jam: 2, waktu: "07.35 - 08.10" },
            { jam: 3, waktu: "08.10 - 08.45" },
            { jam: 4, waktu: "08.45 - 09.20" },
            // Istirahat handled separately
            { jam: 5, waktu: "09.40 - 10.15" },
            { jam: 6, waktu: "10.15 - 10.50" },
            { jam: 7, waktu: "10.50 - 11.25" },
            { jam: 8, waktu: "11.25 - 12.00" },
            { jam: 9, waktu: "12.00 - 12.35" },
        ]

        // Helper to find item
        const findItem = (day: string, jam: number) => schedule.find(s => s.hari === day && s.jamKe === jam)

        for (const preset of PRESET_TIMES) {
            // Insert Break before Jam 5
            if (preset.jam === 5) {
                const breakRow = ws.addRow([
                    "",
                    "09.20 - 09.40",
                    "ISTIRAHAT", "", "", "", "" // Fill to merge
                ])
                ws.mergeCells(`C${breakRow.number}:G${breakRow.number}`)
                breakRow.eachCell((cell) => {
                    cell.style = {
                        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDDDDD' } },
                        font: { bold: true, size: 12 },
                        alignment: { horizontal: 'center', vertical: 'middle' },
                        border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                    }
                })
            }

            const timeDisplay = preset.waktu

            const sen = findItem("Senin", preset.jam)
            const sel = findItem("Selasa", preset.jam)
            const rab = findItem("Rabu", preset.jam)
            const kam = findItem("Kamis", preset.jam)
            const jum = findItem("Jumat", preset.jam)

            const row = ws.addRow([
                preset.jam === 0 ? "" : preset.jam,
                timeDisplay,
                sen ? (sen.guru ? `${sen.mapel}\n(${sen.guru})` : sen.mapel) : "",
                sel ? (sel.guru ? `${sel.mapel}\n(${sel.guru})` : sel.mapel) : "",
                rab ? (rab.guru ? `${rab.mapel}\n(${rab.guru})` : rab.mapel) : "",
                kam ? (kam.guru ? `${kam.mapel}\n(${kam.guru})` : kam.mapel) : "",
                jum ? (jum.guru ? `${jum.mapel}\n(${jum.guru})` : jum.mapel) : "",
            ])

            row.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }

                // Colorize Schedule Cells (Columns C-G, index 3-7)
                if (colNumber >= 3 && colNumber <= 7 && cell.value) {
                    const text = cell.value.toString().split('\n')[0] // Get mapel name
                    const fill = getSubjectFill(text)

                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: fill.argb }
                    }
                    cell.font = {
                        color: { argb: fill.text }
                    }
                }
            })
            row.height = 30 // Reduced height as requested
        }

        function getSubjectFill(mapel: string) {
            const m = mapel.toLowerCase()
            // Using Vivid ARGB Colors from Frontend Logic
            if (m.includes("upacara")) return { argb: 'FF4B5563', text: 'FFFFFFFF' } // Gray-600
            if (m.includes("indonesia")) return { argb: 'FF2563EB', text: 'FFFFFFFF' } // Blue-600
            if (m.includes("ipas")) return { argb: 'FF059669', text: 'FFFFFFFF' } // Emerald-600
            if (m.includes("mtk") || m.includes("matematika")) return { argb: 'FFDC2626', text: 'FFFFFFFF' } // Red-600
            if (m.includes("pancasila")) return { argb: 'FFF59E0B', text: 'FF000000' } // Amber-500 (Text Black)
            if (m.includes("seni")) return { argb: 'FFDB2777', text: 'FFFFFFFF' } // Pink-600
            if (m.includes("sunda")) return { argb: 'FF0891B2', text: 'FFFFFFFF' } // Cyan-600
            if (m.includes("pai")) return { argb: 'FF16A34A', text: 'FFFFFFFF' } // Green-600
            if (m.includes("pjok") || m.includes("senam")) return { argb: 'FFF97316', text: 'FFFFFFFF' } // Orange-500
            if (m.includes("inggris")) return { argb: 'FF4F46E5', text: 'FFFFFFFF' } // Indigo-600
            if (m.includes("p5")) return { argb: 'FF65A30D', text: 'FFFFFFFF' } // Lime-600
            if (m.includes("kaulinan")) return { argb: 'FFCA8A04', text: 'FFFFFFFF' } // Yellow-600
            if (m.includes("koding")) return { argb: 'FF7C3AED', text: 'FFFFFFFF' } // Violet-600
            if (m.includes("literasi")) return { argb: 'FF0284C7', text: 'FFFFFFFF' } // Sky-600

            return { argb: 'FFFFFFFF', text: 'FF000000' } // White
        }

        const buffer = await wb.xlsx.writeBuffer()

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Jadwal_Kelas_${kelas}.xlsx"`
            }
        })

    } catch (error) {
        console.error("Error export jadwal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
