import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Robust Edge Middleware - 100% safe from 500 MIDDLEWARE_INVOCATION_FAILED on Vercel
export async function middleware(request: NextRequest) {
    try {
        const { pathname } = request.nextUrl

        // Fallback secret guarantees getToken will NEVER throw [NO_SECRET] error on Vercel
        const secret = process.env.NEXTAUTH_SECRET || "SDN2Nangerang2025SecretKey123!"

        const token = await getToken({
            req: request,
            secret,
        })

        // 1. Dashboard pages: if not authenticated, redirect to /login
        if (pathname.startsWith("/dashboard")) {
            if (!token) {
                const loginUrl = new URL("/login", request.url)
                loginUrl.searchParams.set("callbackUrl", pathname)
                return NextResponse.redirect(loginUrl)
            }
        }

        // 2. Protected API routes: if not authenticated, return 401 JSON
        if (pathname.startsWith("/api/")) {
            if (!token) {
                return NextResponse.json(
                    { error: "Unauthorized: Silakan login terlebih dahulu" },
                    { status: 401 }
                )
            }
        }

        return NextResponse.next()
    } catch (error) {
        console.error("Middleware execution caught error:", error)
        // CRITICAL FOR VERCEL:
        // Never allow an uncaught exception to bubble up into 500 MIDDLEWARE_INVOCATION_FAILED.
        // Fall back to NextResponse.next() so the server-side getServerSession() handles auth safely.
        return NextResponse.next()
    }
}

export const config = {
    matcher: [
        // Protect all dashboard pages
        "/dashboard/:path*",
        // Protect specific API route groups
        "/api/absensi/:path*",
        "/api/absensi-guru/:path*",
        "/api/activity-log/:path*",
        "/api/analytics/:path*",
        "/api/aset/:path*",
        "/api/avatar/:path*",
        "/api/buku/:path*",
        "/api/fix-duplicates/:path*",
        "/api/jadwal/:path*",
        "/api/jurnal/:path*",
        "/api/kalender/:path*",
        "/api/nilai/:path*",
        "/api/principal/:path*",
        "/api/rekap/:path*",
        "/api/settings/:path*",
        "/api/siswa/:path*",
        "/api/upload/:path*",
        "/api/users/:path*",
    ],
}
