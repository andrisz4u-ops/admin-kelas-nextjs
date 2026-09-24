import { withAuth } from "next-auth/middleware"

// Global middleware: protects all /dashboard and /api routes except auth endpoints
// Compatible with Vercel Edge Runtime
export default withAuth({
    callbacks: {
        authorized: ({ token }) => !!token,
    },
    pages: {
        signIn: "/login",
    },
})

export const config = {
    matcher: [
        // Protect all dashboard pages
        "/dashboard/:path*",
        // Protect specific API route groups (explicit list, more reliable on Vercel)
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
        "/api/nilai/:path*",
        "/api/principal/:path*",
        "/api/rekap/:path*",
        "/api/settings/:path*",
        "/api/siswa/:path*",
        "/api/upload/:path*",
        "/api/users/:path*",
    ],
}
