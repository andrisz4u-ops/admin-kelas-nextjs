import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { absensiService } from "@/services/absensiService"

export const dynamic = "force-dynamic"

// GET rekap absensi
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const kelas = parseInt(searchParams.get("kelas") || "5")
        const type = searchParams.get("type") || "month" // "month" or "semester"
        const month = parseInt(searchParams.get("month") || new Date().getMonth().toString())
        const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
        const semester = parseInt(searchParams.get("semester") || "1")
        const tahunAjaranParam = searchParams.get("tahunAjaran")

        const result = await absensiService.getRekapAbsensi({
            kelas,
            type,
            month,
            year,
            semester,
            tahunAjaranParam,
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error("Error generating rekap absensi:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
