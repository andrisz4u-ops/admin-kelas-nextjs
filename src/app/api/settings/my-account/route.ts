import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import bcrypt from "bcryptjs"

export const dynamic = 'force-dynamic'

// GET current user's account info
export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                nip: true,
                kelas: true,
                mapelDiampu: true,
                fotoProfilUrl: true
            }
        })

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        return NextResponse.json(user)
    } catch (error) {
        console.error("Error fetching my account:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST update current user's account (password, name, etc.)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { name, username, currentPassword, newPassword, fotoProfilUrl } = await request.json()

        // Prepare update data
        const updateData: any = {}

        // Update name if provided
        if (name && name.trim() !== "") {
            updateData.name = name.trim()
        }

        // Update username if provided (admin only can change their own username)
        if (username && username.trim() !== "" && session.user.role === "admin") {
            // Check if username is already taken by another user
            const existingUser = await prisma.user.findFirst({
                where: {
                    username: username.trim(),
                    id: { not: session.user.id }
                }
            })
            if (existingUser) {
                return NextResponse.json({ error: "Username sudah digunakan" }, { status: 400 })
            }
            updateData.username = username.trim()
        }

        // Update password if provided
        if (newPassword && newPassword.trim() !== "") {
            if (newPassword.length < 6) {
                return NextResponse.json({ error: "Password baru minimal harus 6 karakter" }, { status: 400 })
            }

            // Verify current password first
            if (!currentPassword) {
                return NextResponse.json({ error: "Password lama diperlukan untuk mengubah password" }, { status: 400 })
            }

            const user = await prisma.user.findUnique({
                where: { id: session.user.id },
                select: { password: true }
            })

            if (!user) {
                return NextResponse.json({ error: "User not found" }, { status: 404 })
            }

            const isValidPassword = await bcrypt.compare(currentPassword, user.password)
            if (!isValidPassword) {
                return NextResponse.json({ error: "Password lama tidak sesuai" }, { status: 400 })
            }

            // Hash new password
            updateData.password = await bcrypt.hash(newPassword, 10)
        }

        // Update profile photo if provided (allow string URL or null to remove photo)
        if (fotoProfilUrl !== undefined) {
            updateData.fotoProfilUrl = fotoProfilUrl
        }

        // Only update if there's something to update
        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: "Tidak ada data yang diubah" }, { status: 400 })
        }

        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: updateData,
            select: {
                id: true,
                name: true,
                username: true,
                role: true,
                nip: true,
                kelas: true,
                mapelDiampu: true,
                fotoProfilUrl: true
            }
        })

        return NextResponse.json({ success: true, message: "Akun berhasil diperbarui", user: updatedUser })
    } catch (error) {
        console.error("Error updating my account:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
