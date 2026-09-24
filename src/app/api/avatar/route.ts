import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get("userId")

        if (!userId) {
            return new NextResponse("Missing userId parameter", { status: 400 })
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { fotoProfilUrl: true }
        })

        if (!user || !user.fotoProfilUrl) {
            // Return 404 or default fallback avatar
            return NextResponse.redirect(new URL("/logo-sekolah.png", request.url))
        }

        // If it's a Base64 data URL, parse and return binary image
        if (user.fotoProfilUrl.startsWith("data:")) {
            const matches = user.fotoProfilUrl.match(/^data:([A-Za-z0-9-+\/]+);base64,(.+)$/)
            if (matches) {
                const contentType = matches[1]
                const buffer = Buffer.from(matches[2], "base64")
                return new NextResponse(buffer, {
                    status: 200,
                    headers: {
                        "Content-Type": contentType,
                        "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
                    }
                })
            }
        }

        // If it's a local relative path (starts with /)
        if (user.fotoProfilUrl.startsWith("/") && !user.fotoProfilUrl.startsWith("//")) {
            return NextResponse.redirect(new URL(user.fotoProfilUrl, request.url))
        }

        // If external URL, validate protocol
        try {
            const parsedUrl = new URL(user.fotoProfilUrl)
            if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
                return NextResponse.redirect(parsedUrl.toString())
            }
        } catch {
            // Invalid URL format
        }

        return NextResponse.redirect(new URL("/logo-sekolah.png", request.url))
    } catch (error) {
        console.error("Error serving avatar:", error)
        return new NextResponse("Internal server error", { status: 500 })
    }
}
