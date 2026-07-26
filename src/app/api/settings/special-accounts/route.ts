import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

// GET all kepsek and pengawas accounts
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const accounts = await prisma.user.findMany({
            where: {
                OR: [
                    { role: { in: ["kepsek", "pengawas", "guru_mapel"] } },
                    { role: "guru", kelas: null } // Include guru without class (Staff/Penjaga)
                ]
            },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                mapelDiampu: true,
                nip: true,
                fotoProfilUrl: true
            },
            orderBy: { role: "asc" }
        })

        return NextResponse.json(accounts)
    } catch (error) {
        console.error("Error fetching special accounts:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST update special accounts (create or update)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { accounts } = await request.json()

        for (const account of accounts) {
            const { id, name, username, password, role, mapelDiampu, nip, fotoProfilUrl } = account

            // Validate role 
            // Allow kepsek, pengawas, guru_mapel, AND guru (for staff/penjaga)
            if (!["kepsek", "pengawas", "guru_mapel", "guru"].includes(role)) {
                continue
            }

            if (id) {
                // Update existing account
                const updateData: any = {
                    name,
                    username,
                    nip
                }
                if (password && password.trim() !== "") {
                    updateData.password = await bcrypt.hash(password, 10)
                }
                if (fotoProfilUrl !== undefined) {
                    updateData.fotoProfilUrl = fotoProfilUrl
                }
                if (role === "guru_mapel" && mapelDiampu !== undefined) {
                    updateData.mapelDiampu = mapelDiampu
                }

                await prisma.user.update({
                    where: { id },
                    data: updateData,
                })
            } else if (username && name) {
                // Create new account
                const hashedPassword = await bcrypt.hash(password || "password123", 10)
                await prisma.user.create({
                    data: {
                        name,
                        username,
                        password: hashedPassword,
                        role,
                        nip,
                        fotoProfilUrl,
                        mapelDiampu: role === "guru_mapel" ? mapelDiampu : undefined
                    },
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error updating special accounts:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE permanently remove an account
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { id } = await request.json()

        if (!id) {
            return NextResponse.json({ error: "ID akun harus disertakan" }, { status: 400 })
        }

        // Fetch the user to validate
        const user = await prisma.user.findUnique({ where: { id } })
        if (!user) {
            return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 })
        }

        // Protect admin account
        if (user.username === "admin" || user.role === "admin") {
            return NextResponse.json({ error: "Akun admin tidak dapat dihapus" }, { status: 403 })
        }

        // Delete the user (cascade will handle activity logs)
        await prisma.user.delete({ where: { id } })

        return NextResponse.json({ success: true, message: `Akun ${user.name} berhasil dihapus` })
    } catch (error) {
        console.error("Error deleting account:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
