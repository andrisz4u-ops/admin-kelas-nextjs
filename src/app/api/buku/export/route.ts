import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import ExcelJS from "exceljs"

export const dynamic = 'force-dynamic'

// GET - Export buku to Excel
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const bukuList = await prisma.buku.findMany({
            orderBy: { judul: "asc" }
        })

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook()
        const worksheet = workbook.addWorksheet("Daftar Buku")

        // Set column headers
        worksheet.columns = [
            { header: "No", key: "no", width: 5 },
            { header: "Judul", key: "judul", width: 40 },
            { header: "Penulis", key: "penulis", width: 25 },
            { header: "Penerbit", key: "penerbit", width: 20 },
            { header: "Tahun Terbit", key: "tahunTerbit", width: 12 },
            { header: "ISBN", key: "isbn", width: 18 },
            { header: "Kategori", key: "kategori", width: 15 },
            { header: "Kelas", key: "kelas", width: 8 },
            { header: "Jumlah Copy", key: "jumlahCopy", width: 12 },
            { header: "Lokasi", key: "lokasi", width: 15 },
        ]

        // Style header row
        const headerRow = worksheet.getRow(1)
        headerRow.font = { bold: true }
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4472C4" }
        }
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } }
        headerRow.alignment = { horizontal: "center", vertical: "middle" }

        // Add data rows
        bukuList.forEach((buku, index) => {
            worksheet.addRow({
                no: index + 1,
                judul: buku.judul,
                penulis: buku.penulis,
                penerbit: buku.penerbit || "",
                tahunTerbit: buku.tahunTerbit || "",
                isbn: buku.isbn || "",
                kategori: buku.kategori,
                kelas: buku.kelas ? `Kelas ${buku.kelas}` : "",
                jumlahCopy: buku.jumlahCopy,
                lokasi: buku.lokasi || "",
            })
        })

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
                "Content-Disposition": `attachment; filename="Daftar_Buku_Perpustakaan.xlsx"`,
            },
        })
    } catch (error) {
        console.error("Error exporting buku:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
