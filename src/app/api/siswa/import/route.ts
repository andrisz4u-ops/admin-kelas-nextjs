import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

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

        // Prepare data - use each student's kelas if allClasses mode, otherwise use the kelas parameter
        const data = students.map((s: { nis: string; nama: string; jenisKelamin: string; kelas?: number; alamat?: string; namaOrtu?: string; noHp?: string }) => ({
            nis: String(s.nis).trim(),
            nama: String(s.nama).trim(),
            jenisKelamin: String(s.jenisKelamin || "L").toUpperCase(),
            kelas: allClasses && s.kelas ? parseInt(String(s.kelas)) : parseInt(String(kelas)),
            alamat: s.alamat || null,
            namaOrtu: s.namaOrtu || null,
            noHp: s.noHp || null,
            status: "aktif",
        }))

        // Execute atomic transaction to prevent data loss on replace failure
        const result = await prisma.$transaction(async (tx) => {
            if (replace) {
                if (allClasses) {
                    await tx.siswa.deleteMany({
                        where: { kelas: { in: [1, 2, 3, 4, 5, 6] }, status: "aktif" }
                    })
                } else {
                    await tx.siswa.deleteMany({
                        where: { kelas: parseInt(String(kelas)), status: "aktif" }
                    })
                }
            }

            const inserted = await tx.siswa.createMany({
                data,
                skipDuplicates: true,
            })

            // Log activity
            if (session.user?.id) {
                await tx.activityLog.create({
                    data: {
                        userId: session.user.id,
                        action: "IMPORT_SISWA",
                        details: `Mengimpor ${inserted.count} siswa ${allClasses ? 'ke semua kelas' : `ke kelas ${kelas}`}${replace ? ' (mode replace)' : ''}.`,
                    }
                })
            }

            return inserted
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
