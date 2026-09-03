import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user?.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Hanya admin yang berhak menjalankan pembersihan duplikat." }, { status: 401 })
        }

        console.log("Starting deduplication...")
        const deletedUsers: string[] = []

        // 1. Fix Cecep & Kuraesin (Keep ones with NIP)
        const targets = ["Cecep Rif'at Syarifudin, S.Pd", "Kuraesin, S.Pd.I"]

        for (const name of targets) {
            const users = await prisma.user.findMany({
                where: { name: name },
                orderBy: { createdAt: 'desc' } // Newest first
            })

            if (users.length > 1) {
                // Keep the one with NIP, or the newest one if both have NIP
                const keeper = users.find(u => u.nip && u.nip.length > 5) || users[0]

                for (const user of users) {
                    if (user.id !== keeper.id) {
                        await prisma.user.delete({ where: { id: user.id } })
                        deletedUsers.push(`${user.name} (No NIP/Duplicate)`)
                    }
                }
            }
        }

        // 2. Fix Kepala Sekolah (Duplicate Identical)
        const kepseks = await prisma.user.findMany({
            where: { role: "kepsek" }
        })

        if (kepseks.length > 1) {
            // Keep the one with username 'kepsek' if possible, or just the first one
            const keeper = kepseks.find(u => u.username === "kepsek") || kepseks[0]
            for (const k of kepseks) {
                if (k.id !== keeper.id) {
                    await prisma.user.delete({ where: { id: k.id } })
                    deletedUsers.push(`Kepala Sekolah Duplicate (${k.id})`)
                }
            }
        }

        // 3. Delete Dummy Guru (guru1 - guru6)
        const dummyGurus = await prisma.user.findMany({
            where: {
                username: { in: ["guru1", "guru2", "guru3", "guru4", "guru5", "guru6"] }
            }
        })

        for (const dummy of dummyGurus) {
            await prisma.user.delete({ where: { id: dummy.id } })
            deletedUsers.push(`Deleted Dummy: ${dummy.name} (${dummy.username})`)
        }

        return NextResponse.json({
            success: true,
            deleted: deletedUsers,
            message: `Berhasil menghapus ${deletedUsers.length} akun duplikat.`
        })

    } catch (error) {
        console.error("Deduplication Error:", error)
        return NextResponse.json({ error: "Gagal menghapus duplikat", details: error }, { status: 500 })
    }
}
