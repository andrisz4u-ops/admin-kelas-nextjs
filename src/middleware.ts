import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token
        const pathname = req.nextUrl.pathname

        if (!token) {
            return NextResponse.redirect(new URL("/login", req.url))
        }

        const role = token.role as string

        // 1. Admin-only routes
        const adminRoutes = [
            "/dashboard/manajemen-akun",
            "/dashboard/absensi-guru",
            "/dashboard/activity-log",
        ]
        if (adminRoutes.some(route => pathname.startsWith(route)) && role !== "admin") {
            return NextResponse.redirect(new URL("/dashboard", req.url))
        }

        // 2. Kepsek / Pengawas monitoring
        if (pathname.startsWith("/dashboard/kepala-sekolah")) {
            if (role !== "kepsek" && role !== "pengawas" && role !== "admin") {
                return NextResponse.redirect(new URL("/dashboard", req.url))
            }
        }

        // 3. Guru mapel restrictions
        if (role === "guru_mapel") {
            const restrictedForGuruMapel = [
                "/dashboard/siswa",
                "/dashboard/perpustakaan",
                "/dashboard/aset",
            ]
            if (restrictedForGuruMapel.some(route => pathname.startsWith(route))) {
                return NextResponse.redirect(new URL("/dashboard", req.url))
            }
        }

        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: "/login",
        },
    }
)

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/api/settings/database/:path*",
        "/api/settings/special-accounts/:path*",
    ],
}
