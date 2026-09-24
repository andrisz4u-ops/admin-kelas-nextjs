import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { parseToUTCMidnight } from "@/lib/dateUtils"

export const dynamic = "force-dynamic"

// PUT update jurnal
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRole = session.user.role
        const userKelas = session.user.kelas

        // Kepsek & Pengawas bersifat Read-Only untuk agenda jurnal
        if (userRole === "kepsek" || userRole === "pengawas") {
            return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
        }

        const { id } = await params

        // Periksa apakah jurnal ada dan kepemilikan kelas guru
        const existing = await prisma.jurnal.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 })
        }

        if (userRole === "guru" && userKelas && existing.kelas !== userKelas) {
            return NextResponse.json({
                error: `Akses ditolak. Sebagai wali kelas ${userKelas}, Anda tidak berhak mengubah agenda kelas ${existing.kelas}.`
            }, { status: 403 })
        }

        const body = await request.json()
        const {
            tanggal,
            jamKe,
            mapel,
            materi,
            metode,
            catatan,
            siswaAbsen,
            kategori,
            jmlSakit,
            jmlIzin,
            jmlAlpha,
            jmlHadir,
            jmlTdkHadir,
            paraf
        } = body

        const jurnal = await prisma.jurnal.update({
            where: { id },
            data: {
                tanggal: parseToUTCMidnight(tanggal),
                jamKe,
                mapel,
                materi,
                metode: metode || "-",
                catatan,
                siswaAbsen,
                kategori: kategori || "KBM",
                jmlSakit: jmlSakit !== undefined ? Number(jmlSakit) : 0,
                jmlIzin: jmlIzin !== undefined ? Number(jmlIzin) : 0,
                jmlAlpha: jmlAlpha !== undefined ? Number(jmlAlpha) : 0,
                jmlHadir: jmlHadir !== undefined ? Number(jmlHadir) : null,
                jmlTdkHadir: jmlTdkHadir !== undefined ? Number(jmlTdkHadir) : 0,
                paraf: paraf || null,
            },
        })

        return NextResponse.json(jurnal)
    } catch (error) {
        console.error("Error updating jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE jurnal
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const userRole = session.user.role
        const userKelas = session.user.kelas

        // Kepsek & Pengawas bersifat Read-Only untuk agenda jurnal
        if (userRole === "kepsek" || userRole === "pengawas") {
            return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
        }

        const { id } = await params

        // Periksa apakah jurnal ada dan kepemilikan kelas guru
        const existing = await prisma.jurnal.findUnique({ where: { id } })
        if (!existing) {
            return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 })
        }

        if (userRole === "guru" && userKelas && existing.kelas !== userKelas) {
            return NextResponse.json({
                error: `Akses ditolak. Sebagai wali kelas ${userKelas}, Anda tidak berhak menghapus agenda kelas ${existing.kelas}.`
            }, { status: 403 })
        }

        await prisma.jurnal.delete({ where: { id } })

        return NextResponse.json({ message: "Jurnal deleted" })
    } catch (error) {
        console.error("Error deleting jurnal:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
