import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

export const dynamic = 'force-dynamic'

const KIB_LABELS: Record<string, string> = {
    "A": "KIB A - Tanah",
    "B": "KIB B - Peralatan & Mesin",
    "C": "KIB C - Gedung & Bangunan",
    "D": "KIB D - Jalan, Irigasi & Jaringan",
    "E": "KIB E - Aset Tetap Lainnya"
}

// GET - Export aset to Excel
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const asetList = await prisma.aset.findMany({
            orderBy: [{ kib: "asc" }, { namaAset: "asc" }]
        })

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet("Data Aset Sekolah")

        // Set column headers
        worksheet.columns = [
            { header: "No", key: "no", width: 5 },
            { header: "KIB", key: "kib", width: 8 },
            { header: "Nama Aset", key: "namaAset", width: 35 },
            { header: "Kategori", key: "kategori", width: 18 },
            { header: "Jumlah", key: "jumlah", width: 8 },
            { header: "Kondisi", key: "kondisi", width: 12 },
            { header: "Lokasi", key: "lokasi", width: 15 },
            { header: "Tahun Perolehan", key: "tahunPerolehan", width: 15 },
            { header: "Sumber Dana", key: "sumberDana", width: 15 },
            { header: "Harga Perolehan", key: "hargaPerolehan", width: 18 },
            { header: "Nilai Per Unit", key: "nilaiPerUnit", width: 15 },
            { header: "Bukti Kepemilikan", key: "buktiKepemilikan", width: 20 },
            { header: "Keterangan", key: "keterangan", width: 25 },
        ]

        // Style header row
        const headerRow = worksheet.getRow(1)
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" }
        }
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
        headerRow.alignment = { horizontal: "center", vertical: "middle" }

        // Add data rows
        asetList.forEach((aset, index) => {
            worksheet.addRow({
                no: index + 1,
                kib: aset.kib,
                namaAset: aset.namaAset,
                kategori: aset.kategori,
                jumlah: aset.jumlah,
                kondisi: aset.kondisi,
                lokasi: aset.lokasi || "",
                tahunPerolehan: aset.tahunPerolehan,
                sumberDana: aset.sumberDana,
                hargaPerolehan: aset.hargaPerolehan,
                nilaiPerUnit: aset.nilaiPerUnit || "",
                buktiKepemilikan: aset.buktiKepemilikan || "",
                keterangan: aset.keterangan || "",
            })
        })

        // Format currency columns
        worksheet.getColumn("hargaPerolehan").numFmt = "#,##0"
        worksheet.getColumn("nilaiPerUnit").numFmt = "#,##0"

        // Add borders to all cells
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin" },
                    left: { style: "thin" },
                    bottom: { style: "thin" },
                    right: { style: "thin" },
                }
                if (rowNumber > 1) {
                    cell.alignment = { vertical: "middle" }
                }
            })
        })

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer()

        // Return Excel file
        return new NextResponse(buffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="Data_Aset_Sekolah.xlsx"`,
            },
        })
    } catch (error) {
        console.error("Error exporting aset:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
