import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// POST import multiple students
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat mengimpor data siswa" }, { status: 403 })
        }

        const { students, kelas, replace, allClasses } = await request.json()

        if (!Array.isArray(students) || students.length === 0) {
            return NextResponse.json({ error: "No data to import" }, { status: 400 })
        }

        // If replace, delete existing active students only (never delete alumni)
        if (replace) {
            if (allClasses) {
                // Delete active students from classes 1-6
                await prisma.siswa.deleteMany({
                    where: { kelas: { in: [1, 2, 3, 4, 5, 6] }, status: "aktif" }
                })
            } else {
                // Delete only active students from selected class
                await prisma.siswa.deleteMany({ where: { kelas: parseInt(kelas), status: "aktif" } })
            }
        }

        // Prepare data - use each student's kelas if allClasses mode, otherwise use the kelas parameter
        const data = students.map((s: { nis: string; nama: string; jenisKelamin: string; kelas?: number; alamat?: string; namaOrtu?: string; noHp?: string }) => ({
            nis: String(s.nis),
            nama: String(s.nama),
            jenisKelamin: String(s.jenisKelamin || "L").toUpperCase(),
            kelas: allClasses && s.kelas ? s.kelas : parseInt(kelas),
            alamat: s.alamat || null,
            namaOrtu: s.namaOrtu || null,
            noHp: s.noHp || null,
        }))

        // Create many
        const result = await prisma.siswa.createMany({
            data,
            skipDuplicates: true,
        })

        const message = allClasses
            ? `${result.count} siswa berhasil diimport ke semua kelas`
            : `${result.count} siswa berhasil diimport ke kelas ${kelas}`

        return NextResponse.json({
            message,
            count: result.count
        })
    } catch (error) {
        console.error("Error importing siswa:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
