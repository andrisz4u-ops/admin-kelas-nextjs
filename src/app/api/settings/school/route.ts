import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getDefaultAcademicYear } from "@/lib/academicYear"

export async function GET() {
    try {
        const settings = await prisma.schoolSettings.findFirst()
        const defaultYear = getDefaultAcademicYear()

        let kepsekUser: { name: string; nip: string | null } | null = null
        if (!settings?.kepalaSekolah || !settings?.nipKepsek) {
            kepsekUser = await prisma.user.findFirst({
                where: { role: "kepsek" },
                select: { name: true, nip: true }
            })
        }

        return NextResponse.json({
            id: settings?.id || "main",
            namaSekolah: settings?.namaSekolah || "SDN 2 Nangerang",
            kepalaSekolah: settings?.kepalaSekolah || kepsekUser?.name || "",
            nipKepsek: settings?.nipKepsek || kepsekUser?.nip || "",
            tahunAjaran: settings?.tahunAjaran || defaultYear,
            semesterAktif: settings?.semesterAktif || 1
        })
    } catch (error) {
        console.error("Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Hanya admin yang boleh mengubah pengaturan sekolah
        if (session.user.role !== "admin") {
            return NextResponse.json({ error: "Hanya admin yang dapat mengubah pengaturan sekolah." }, { status: 403 })
        }

        const body = await request.json()

        const { namaSekolah, kepalaSekolah, nipKepsek, tahunAjaran, semesterAktif } = body
        const parsedSemester = semesterAktif ? parseInt(String(semesterAktif)) : 1

        const settings = await prisma.schoolSettings.upsert({
            where: { id: "main" },
            update: { namaSekolah, kepalaSekolah, nipKepsek, tahunAjaran, semesterAktif: parsedSemester },
            create: { id: "main", namaSekolah, kepalaSekolah, nipKepsek, tahunAjaran, semesterAktif: parsedSemester },
        })

        return NextResponse.json(settings)
    } catch (error) {
        console.error("Error:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
