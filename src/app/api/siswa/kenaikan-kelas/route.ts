import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET: preview jumlah siswa aktif per kelas
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Count active students per class
        const counts = await prisma.siswa.groupBy({
            by: ["kelas"],
            where: { status: "aktif" },
            _count: { id: true },
            orderBy: { kelas: "asc" },
        })

        const perKelas: Record<number, number> = {}
        for (const c of counts) {
            perKelas[c.kelas] = c._count.id
        }

        const settings = await prisma.schoolSettings.findFirst()
        const tahunAjaranSekarang = settings?.tahunAjaran || "2025/2026"

        // Auto-calculate next school year
        const tahunAjaranBaru = hitungTahunAjaranBaru(tahunAjaranSekarang)

        return NextResponse.json({
            perKelas,
            tahunAjaranSekarang,
            tahunAjaranBaru,
        })
    } catch (error) {
        console.error("Error fetching preview:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST: proses kenaikan kelas
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Check role via session metadata
        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat memproses kenaikan kelas" }, { status: 403 })
        }

        const body = await request.json()
        const { tahunAjaranBaru } = body

        if (!tahunAjaranBaru) {
            return NextResponse.json({ error: "Tahun ajaran baru harus diisi" }, { status: 400 })
        }

        // Get current school settings
        const settings = await prisma.schoolSettings.findFirst()
        const tahunAjaranSekarang = settings?.tahunAjaran || "2025/2026"

        // Run everything in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // 1. Count students per class before processing
            const countsBefore = await tx.siswa.groupBy({
                by: ["kelas"],
                where: { status: "aktif" },
                _count: { id: true },
                orderBy: { kelas: "asc" },
            })
            const perKelasBefore: Record<number, number> = {}
            for (const c of countsBefore) {
                perKelasBefore[c.kelas] = c._count.id
            }

            // 2. Archive class 6 students as alumni and set kelas to 0
            const alumni = await tx.siswa.updateMany({
                where: { kelas: 6, status: "aktif" },
                data: {
                    status: "alumni",
                    kelas: 0,
                    tahunLulus: tahunAjaranSekarang,
                },
            })

            // 3. Promote classes 1-5 to next class (process from high to low to avoid conflicts)
            // Update kelas 5 → 6
            await tx.siswa.updateMany({
                where: { kelas: 5, status: "aktif" },
                data: { kelas: 6 },
            })
            // Update kelas 4 → 5
            await tx.siswa.updateMany({
                where: { kelas: 4, status: "aktif" },
                data: { kelas: 5 },
            })
            // Update kelas 3 → 4
            await tx.siswa.updateMany({
                where: { kelas: 3, status: "aktif" },
                data: { kelas: 4 },
            })
            // Update kelas 2 → 3
            await tx.siswa.updateMany({
                where: { kelas: 2, status: "aktif" },
                data: { kelas: 3 },
            })
            // Update kelas 1 → 2
            await tx.siswa.updateMany({
                where: { kelas: 1, status: "aktif" },
                data: { kelas: 2 },
            })

            // 4. Update school year in settings
            await tx.schoolSettings.upsert({
                where: { id: "main" },
                update: { tahunAjaran: tahunAjaranBaru },
                create: { id: "main", tahunAjaran: tahunAjaranBaru },
            })

            // 5. Log activity
            if (session.user?.id) {
                await tx.activityLog.create({
                    data: {
                        userId: session.user.id,
                        action: "KENAIKAN_KELAS",
                        details: `Proses kenaikan kelas tahun ajaran ${tahunAjaranSekarang} → ${tahunAjaranBaru}. ${alumni.count} siswa kelas 6 diarsipkan sebagai alumni (kelas diset ke 0).`,
                        metadata: JSON.stringify({ perKelasBefore, tahunAjaranSekarang, tahunAjaranBaru }),
                    },
                })
            }

            return {
                alumni: alumni.count,
                perKelasBefore,
                tahunAjaranSekarang,
                tahunAjaranBaru,
            }
        })

        return NextResponse.json({
            message: `Kenaikan kelas berhasil diproses! ${result.alumni} siswa kelas 6 diarsipkan sebagai alumni. Tahun ajaran diperbarui ke ${tahunAjaranBaru}.`,
            ...result,
        })
    } catch (error) {
        console.error("Error processing kenaikan kelas:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

function hitungTahunAjaranBaru(tahunAjaran: string): string {
    // Format: "2025/2026"
    const parts = tahunAjaran.split("/")
    if (parts.length === 2) {
        const tahun1 = parseInt(parts[0])
        const tahun2 = parseInt(parts[1])
        if (!isNaN(tahun1) && !isNaN(tahun2)) {
            return `${tahun1 + 1}/${tahun2 + 1}`
        }
    }
    return tahunAjaran
}
