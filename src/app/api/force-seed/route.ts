import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user?.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized. Hanya admin yang berhak menjalankan seeding manual." }, { status: 401 })
        }

        console.log("Starting manual seed...")

        // 1. Update Kepala Sekolah
        const kepsekPass = await bcrypt.hash("kepsek123", 10)
        await prisma.user.upsert({
            where: { username: "kepsek" },
            update: { name: "H. Ujang Ma'Mun, S.Pd.I." },
            create: {
                username: "kepsek",
                password: kepsekPass,
                name: "H. Ujang Ma'Mun, S.Pd.I.",
                role: "kepsek",
                kelas: null,
            },
        })

        // 2. Create Penjaga (Holid)
        const holidPass = await bcrypt.hash("198208062025211095", 10)
        await prisma.user.upsert({
            where: { username: "198208062025211095" },
            update: {},
            create: {
                username: "198208062025211095",
                password: holidPass,
                name: "Holid Ahsanudin",
                role: "guru",
                kelas: null,
                nip: "198208062025211095"
            },
        })

        // 3. Create Operator (Yani)
        const yaniPass = await bcrypt.hash("199204262025212065", 10)
        await prisma.user.upsert({
            where: { username: "199204262025212065" },
            update: {},
            create: {
                username: "199204262025212065",
                password: yaniPass,
                name: "Yani Herfiyana Apriyani, S.E",
                role: "guru",
                kelas: null,
                nip: "199204262025212065"
            },
        })

        // 4. Ensure Pengawas Exists
        const pengawasPass = await bcrypt.hash("pengawas123", 10)
        await prisma.user.upsert({
            where: { username: "pengawas" },
            update: {},
            create: {
                username: "pengawas",
                password: pengawasPass,
                name: "Pengawas Sekolah",
                role: "pengawas",
                kelas: null,
            },
        })

        // 5. Ensure Guru Mapel Exists (Cecep & Kuraesin)
        const guruPass = await bcrypt.hash("guru123", 10)

        await prisma.user.upsert({
            where: { username: "cecep" },
            update: { role: "guru_mapel", mapelDiampu: "AKPK" },
            create: {
                username: "cecep",
                password: guruPass,
                name: "Cecep Rif'at Syarifudin, S.Pd",
                role: "guru_mapel",
                kelas: null,
                mapelDiampu: "AKPK",
            },
        })

        await prisma.user.upsert({
            where: { username: "kuraesin" },
            update: { role: "guru_mapel", mapelDiampu: "PAI" },
            create: {
                username: "kuraesin",
                password: guruPass,
                name: "Kuraesin, S.Pd.I",
                role: "guru_mapel",
                kelas: null,
                mapelDiampu: "PAI",
            },
        })

        return NextResponse.json({
            success: true,
            message: "Data Holid, Yani, Kepsek, & Guru Mapel berhasil ditambahkan/diupdate!"
        })

    } catch (error) {
        console.error("Force Seed Error:", error)
        return NextResponse.json({ error: "Gagal seeding", details: error }, { status: 500 })
    }
}

export { GET as POST }

