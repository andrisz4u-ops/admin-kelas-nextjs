import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Edge Middleware: 100% resilient across HTTP localhost & HTTPS Vercel production
export async function middleware(request: NextRequest) {
    try {
        const { pathname } = request.nextUrl
        const secret = process.env.NEXTAUTH_SECRET || "SDN2Nangerang2025SecretKey123!"

        // Dual cookie resolution:
        // Try secureCookie: true first (for production HTTPS e.g. __Secure-next-auth.session-token),
        // then fallback to false (for localhost HTTP e.g. next-auth.session-token)
        let token = await getToken({
            req: request,
            secret,
            secureCookie: true,
        })

        if (!token) {
            token = await getToken({
                req: request,
                secret,
                secureCookie: false,
            })
        }

        // 1. If user is at /login and already logged in -> redirect to /dashboard
        if (pathname === "/login") {
            if (token) {
                return NextResponse.redirect(new URL("/dashboard", request.url))
            }
            return NextResponse.next()
        }

        // 2. Dashboard pages: if not authenticated -> redirect to /login
        if (pathname.startsWith("/dashboard")) {
            if (!token) {
                const loginUrl = new URL("/login", request.url)
                loginUrl.searchParams.set("callbackUrl", pathname)
                return NextResponse.redirect(loginUrl)
            }
        }

        // Allow public GET for school settings (login page branding & academic year)
        if (pathname === "/api/settings/school" && request.method === "GET") {
            return NextResponse.next()
        }

        // 3. Protected API routes: if not authenticated -> return 401 JSON
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
        console.error("Middleware Edge Error:", error)
        // Never break the request with a 500 error; let page/API handle auth
        return NextResponse.next()
    }
}

export const config = {
    matcher: [
        "/login",
        "/dashboard/:path*",
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
