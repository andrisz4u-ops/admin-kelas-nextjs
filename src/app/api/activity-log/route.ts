import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

// GET activity logs
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const limit = parseInt(searchParams.get("limit") || "50")
        const page = parseInt(searchParams.get("page") || "1")
        const userId = searchParams.get("userId")
        const action = searchParams.get("action")
        const search = searchParams.get("search") || searchParams.get("q")

        const where: any = {}
        if (userId) where.userId = userId
        if (action) where.action = action
        if (search) {
            where.details = { contains: search, mode: "insensitive" }
        }

        const [logs, total] = await Promise.all([
            prisma.activityLog.findMany({
                where,
                orderBy: { createdAt: "desc" },
                take: limit,
                skip: (page - 1) * limit,
                include: {
                    user: {
                        select: {
                            name: true,
                            username: true,
                            role: true
                        }
                    }
                }
            }),
            prisma.activityLog.count({ where })
        ])

        return NextResponse.json({
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        })
    } catch (error) {
        console.error("Error fetching activity logs:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// POST - Create new activity log entry (for internal use)
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { action, details, metadata } = await request.json()

        const log = await prisma.activityLog.create({
            data: {
                userId: session.user.id,
                action,
                details: details || "",
                metadata: metadata ? JSON.stringify(metadata) : null,
                ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
            }
        })

        return NextResponse.json(log)
    } catch (error) {
        console.error("Error creating activity log:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}

// DELETE - Clear old logs (admin only)
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session || session.user.role !== "admin") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const searchParams = request.nextUrl.searchParams
        const daysOld = parseInt(searchParams.get("daysOld") || "30")

        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - daysOld)

        const deleted = await prisma.activityLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        })

        return NextResponse.json({
            success: true,
            message: `${deleted.count} log entries older than ${daysOld} days deleted`
        })
    } catch (error) {
        console.error("Error deleting activity logs:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
