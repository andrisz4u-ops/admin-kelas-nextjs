import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const kelas = searchParams.get("kelas")
    const mapel = searchParams.get("mapel")
    const semester = searchParams.get("semester")

    if (!kelas && !mapel) return NextResponse.json({ error: "Kelas or mapel is required" }, { status: 400 })

    try {
        const whereClause: any = {}
        if (kelas && kelas !== "ALL") {
            whereClause.kelas = Number(kelas)
        }
        if (mapel) {
            whereClause.mapel = { contains: mapel, mode: "insensitive" }
        }
        if (semester) {
            whereClause.semester = Number(semester)
        }

        const schedule = await prisma.jadwalPelajaran.findMany({
            where: whereClause,
            orderBy: [{ hari: 'asc' }, { jamKe: 'asc' }]
        })
        return NextResponse.json(schedule)
    } catch (error) {
        console.error("Error fetching schedule:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userRole = session.user.role
    if (userRole === "kepsek" || userRole === "pengawas") {
        return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
    }

    try {
        const body = await request.json()

        // Batch Copy Schedule between Semesters
        if (body.action === "copy_semester") {
            const { fromSemester, toSemester, kelas: copyKelas } = body
            if (!fromSemester || !toSemester || !copyKelas) {
                return NextResponse.json({ error: "fromSemester, toSemester, dan kelas diperlukan" }, { status: 400 })
            }
            const sourceSchedules = await prisma.jadwalPelajaran.findMany({
                where: { kelas: Number(copyKelas), semester: Number(fromSemester) }
            })
            if (sourceSchedules.length === 0) {
                return NextResponse.json({ error: `Tidak ada jadwal di Semester ${fromSemester} untuk disalin.` }, { status: 400 })
            }

            await prisma.$transaction(
                sourceSchedules.map((item) => prisma.jadwalPelajaran.upsert({
                    where: {
                        kelas_hari_jamKe_semester: {
                            kelas: Number(copyKelas),
                            hari: item.hari,
                            jamKe: item.jamKe,
                            semester: Number(toSemester)
                        }
                    },
                    update: { waktu: item.waktu, mapel: item.mapel, guru: item.guru },
                    create: {
                        kelas: Number(copyKelas),
                        hari: item.hari,
                        jamKe: item.jamKe,
                        waktu: item.waktu,
                        mapel: item.mapel,
                        guru: item.guru,
                        semester: Number(toSemester)
                    }
                }))
            )
            return NextResponse.json({ success: true, message: `Berhasil menyalin ${sourceSchedules.length} slot jadwal ke Semester ${toSemester}.` })
        }

        const { id, kelas, hari, jamKe, waktu, mapel, guru, semester } = body
        const targetSemester = semester ? Number(semester) : 1

        if (id) {
            // Update
            const updated = await prisma.jadwalPelajaran.update({
                where: { id },
                data: {
                    kelas: Number(kelas),
                    hari,
                    jamKe: Number(jamKe),
                    waktu,
                    mapel,
                    guru,
                    semester: targetSemester
                }
            })
            return NextResponse.json(updated)
        } else {
            // Upsert on compound unique key [kelas, hari, jamKe, semester]
            const upserted = await prisma.jadwalPelajaran.upsert({
                where: {
                    kelas_hari_jamKe_semester: {
                        kelas: Number(kelas),
                        hari,
                        jamKe: Number(jamKe),
                        semester: targetSemester
                    }
                },
                update: { waktu, mapel, guru },
                create: {
                    kelas: Number(kelas),
                    hari,
                    jamKe: Number(jamKe),
                    waktu,
                    mapel,
                    guru,
                    semester: targetSemester
                }
            })
            return NextResponse.json(upserted)
        }
    } catch (error) {
        console.error("Error saving schedule:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const userRole = session.user.role
    if (userRole === "kepsek" || userRole === "pengawas") {
        return NextResponse.json({ error: "Role Anda hanya memiliki izin baca (view-only)." }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 })

    try {
        await prisma.jadwalPelajaran.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
