"use client"

import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"

// Menu items with role permissions
// guruOnly: only for guru (wali kelas)
// adminOnly: only for admin  
// kepsekOnly: only for kepsek
// managementOnly: admin or kepsek
interface MenuItem {
    href?: string
    icon?: string
    label: string
    guruOnly?: boolean
    adminOnly?: boolean
    kepsekOnly?: boolean
    allRoles?: boolean
    isHeader?: boolean
}

const menuItems: MenuItem[] = [
    // Utama
    { label: "Utama", isHeader: true },
    { href: "/dashboard", icon: "home", label: "Dashboard" },

    // Akademik
    { label: "Akademik", isHeader: true },
    { href: "/dashboard/siswa", icon: "users", label: "Data Siswa", guruOnly: true },
    { href: "/dashboard/absensi", icon: "clipboard-check", label: "Daftar Hadir", guruOnly: true },
    { href: "/dashboard/nilai", icon: "chart-line", label: "Daftar Nilai", guruOnly: true },
    { href: "/dashboard/jurnal", icon: "book", label: "Jurnal Harian", guruOnly: true },
    { href: "/dashboard/jadwal", icon: "calendar-days", label: "Jadwal Pelajaran", guruOnly: false, allRoles: true }, // Accessible for Admin (to edit) & Guru (to view/edit)
    { href: "/dashboard/kalender", icon: "calendar", label: "Kalender Akademik" },

    // Laporan
    { label: "Laporan", isHeader: true },
    { href: "/dashboard/rekap-absensi", icon: "calendar-check", label: "Rekap Kehadiran" },
    { href: "/dashboard/rekap-nilai", icon: "document-report", label: "Rekap Nilai" },
    { href: "/dashboard/analitik-nilai", icon: "analytics", label: "Analitik Nilai" },

    // Sarana & Prasarana
    { label: "Sarana & Prasarana", isHeader: true },
    { href: "/dashboard/perpustakaan", icon: "library", label: "Perpustakaan", allRoles: true },
    { href: "/dashboard/aset", icon: "cube", label: "Data Aset", allRoles: true },

    // Administrasi
    { label: "Administrasi", isHeader: true },
    { href: "/dashboard/absensi-guru", icon: "user-check", label: "Daftar Hadir Guru", adminOnly: true },
    { href: "/dashboard/manajemen-akun", icon: "users-cog", label: "Manajemen Akun", adminOnly: true },
    { href: "/dashboard/activity-log", icon: "activity", label: "Log Aktivitas", adminOnly: true },
    { href: "/dashboard/kepala-sekolah", icon: "school", label: "Monitoring Sekolah", kepsekOnly: true },
    { href: "/dashboard/pengaturan", icon: "cog", label: "Pengaturan", adminOnly: true },
]

function Icon({ name, className, strokeWidth = 2 }: { name: string; className?: string; strokeWidth?: number }) {
    const icons: Record<string, React.ReactNode> = {
        home: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
        users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />,
        "clipboard-check": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
        "chart-line": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />,
        book: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
        "calendar-days": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />, // Reusing calendar icon style for now, or differentiate if needed
        "calendar-check": <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 14l2 2 4-4" /></>,
        "document-report": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
        calendar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
        analytics: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></>,
        school: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" /></>,
        cog: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />,
        logout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
        menu: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M4 6h16M4 12h16M4 18h16" />,
        "user-check": <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M16 11l2 2 4-4" /></>,
        library: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></>,
        cube: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
        activity: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 5a2 2 0 002 2h2a2 2 0 002-2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M9 5a2 2 0 012-2h2a2 2 0 012 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 12v6m-3-3h6" /></>,
        "users-cog": <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} d="M19.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm0 0v.5m0 2v-.5m1.5-1.5h-.5m-2 0h-.5" /></>,
    }
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {icons[name]}
        </svg>
    )
}


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [currentKelas, setCurrentKelas] = useState<number>(5)

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login")
        }
        if (session?.user?.kelas) {
            setCurrentKelas(session.user.kelas)
        }
    }, [status, session, router])

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin w-8 h-8 border-4 border-[#667eea] border-t-transparent rounded-full"></div>
            </div>
        )
    }

    if (!session) return null

    const userRole = session.user.role
    const isAdmin = userRole === "admin"
    const isKepsek = userRole === "kepsek"
    const isPengawas = userRole === "pengawas"
    const isGuru = userRole === "guru"
    const isGuruMapel = userRole === "guru_mapel"

    // Function to check if menu item should be shown
    const shouldShowMenuItem = (item: MenuItem, index?: number): boolean => {
        // Handle category headers: only show if at least one subsequent item before next header is visible
        if (item.isHeader) {
            if (index === undefined) return false
            const nextItems: MenuItem[] = []
            for (let i = index + 1; i < menuItems.length; i++) {
                if (menuItems[i].isHeader) break
                nextItems.push(menuItems[i])
            }
            return nextItems.some(child => shouldShowMenuItem(child))
        }

        // Items with allRoles are visible to everyone
        if (item.allRoles) return true

        // Admin can see everything except kepsekOnly
        if (isAdmin) {
            if (item.kepsekOnly) return false
            return true
        }

        // Ensure item.href is present for path checks below
        if (!item.href) return false;

        // Kepsek and Pengawas can see ONLY Monitoring Sekolah and Kalender Akademik
        if (isKepsek || isPengawas) {
            return ["/dashboard/kepala-sekolah", "/dashboard/kalender"].includes(item.href)
        }
        // Guru Mapel can see only limited menu: absensi, rekap-absensi, nilai, rekap-nilai, jadwal, kalender
        if (isGuruMapel) {
            return [
                "/dashboard",
                "/dashboard/absensi",
                "/dashboard/rekap-absensi",
                "/dashboard/nilai",
                "/dashboard/rekap-nilai",
                "/dashboard/jadwal",
                "/dashboard/kalender"
            ].includes(item.href)
        }
        // Guru (wali kelas) can see guruOnly and general items, not adminOnly or kepsekOnly
        if (isGuru) {
            if (item.adminOnly) return false
            if (item.kepsekOnly) return false
            return true
        }
        return false
    }


    return (
        <div className="min-h-screen flex bg-[#f3f4f6]">
            {/* Sidebar - Turbopack Style */}
            <aside className={`fixed inset-y-0 left-0 w-64 bg-white z-[60] border-r border-[#e5e7eb] transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-[#e5e7eb] flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <img src="/logo-sekolah.png" alt="Logo" className="w-8 h-8 object-contain" />
                            <div>
                                <h1 className="font-bold text-sm text-gray-900 tracking-tight">Andris4Edu</h1>
                                <p className="text-[11px] text-gray-500">
                                    {isKepsek ? "Kepala Sekolah" : isPengawas ? "Pengawas" : isAdmin ? "Admin" : "Wali Kelas"}
                                </p>
                            </div>
                        </div>

                        {/* Class Selector - Role Badges */}
                        <div className="mt-4">
                            {isGuru && (
                                <div className="px-3 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600 border border-gray-200 inline-block">
                                    Kelas {currentKelas}
                                </div>
                            )}
                            {isKepsek && (
                                <div className="px-3 py-1 bg-emerald-50 rounded text-xs font-medium text-emerald-700 border border-emerald-200 inline-block">
                                    🏫 SDN 2 Nangerang
                                </div>
                            )}
                            {isPengawas && (
                                <div className="px-3 py-1 bg-purple-50 rounded text-xs font-medium text-purple-700 border border-purple-200 inline-block">
                                    👁️ Pengawas Sekolah
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navigation - Ini bagian yang akan di scroll */}
                    <nav className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-20 scrollbar-thin scrollbar-thumb-gray-200">
                        {menuItems.map((item, index) => {
                            if (!shouldShowMenuItem(item, index)) return null;

                            // Render Header Category
                            if (item.isHeader) {
                                return (
                                    <p key={`header-${index}`} className="px-3 text-[10px] font-bold text-gray-400 uppercase mb-2 mt-5 first:mt-1 tracking-wider">
                                        {item.label}
                                    </p>
                                )
                            }

                            if (!item.href) return null;

                            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)} // Otomatis tutup di mobile
                                    className={`flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg transition-colors text-sm font-medium ${isActive
                                        ? "bg-slate-100 text-slate-900"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    <Icon name={item.icon || "menu"} className={`w-[18px] h-[18px] ${isActive ? 'text-slate-700' : 'text-slate-400'}`} strokeWidth={2} />
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User Profile - Posisinya Tetap Di Bawah (Fixed Bottom within Sidebar) */}
                    <div className="p-4 bg-white/50 backdrop-blur-md border-t border-[#e5e7eb] flex-shrink-0">
                        <div className="flex items-center gap-3 mb-3">
                            {session.user.fotoProfilUrl ? (
                                <img
                                    src={session.user.fotoProfilUrl}
                                    alt={session.user.name || "User"}
                                    className="w-9 h-9 rounded-full object-cover border border-[#e5e7eb]"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                    {session.user.name?.charAt(0)}
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{session.user.name}</p>
                                <p className="text-[11px] text-gray-500 capitalize">{session.user.role.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:text-red-600 hover:bg-red-50 hover:border-red-100 rounded-lg transition-all"
                        >
                            <Icon name="logout" className="w-[14px] h-[14px]" />
                            Log Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[50] lg:hidden transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Topbar/Header untuk Mobile - Ganti tombol melayang dengan Header atas murni di mobile */}
            <div className={`fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-[40] flex items-center justify-between px-4 lg:hidden transition-all ${sidebarOpen ? 'blur-sm pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2">
                    <img src="/logo-sekolah.png" alt="Logo" className="w-7 h-7 object-contain" />
                    <span className="font-bold text-gray-800">Andris4Edu</span>
                </div>
                <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 -mr-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    aria-label="Buka Menu"
                >
                    <Icon name="menu" className="w-6 h-6" />
                </button>
            </div>

            {/* Main content */}
            <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 lg:ml-64 bg-[#f3f4f6] min-h-screen pt-16 lg:pt-0`}>
                <div className="flex-1 p-4 md:p-6 lg:p-8 w-full max-w-[1400px] mx-auto overflow-x-hidden">
                    {children}
                </div>
            </main>
        </div>
    )
}





