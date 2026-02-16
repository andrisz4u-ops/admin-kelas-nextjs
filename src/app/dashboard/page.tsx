"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState, useEffect } from "react"

export const dynamic = 'force-dynamic'

interface SchoolInfo {
    namaSekolah: string
    kepalaSekolah: string
    nipKepsek: string
    tahunAjaran: string
}

interface WaliKelas {
    nama: string
    nip: string
}

interface ClassSummary {
    kelas: number
    totalSiswa: number
    hadir: number
    sakit: number
    izin: number
    alpha: number
    jurnalBulanIni: number
    rataRataNilai: number
}

export default function DashboardPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const isAdmin = session?.user?.role === "admin"
    const isGuruMapel = session?.user?.role === "guru_mapel"
    const isKepsek = session?.user?.role === "kepsek"
    const isPengawas = session?.user?.role === "pengawas"
    const userKelas = session?.user?.kelas

    // Redirect kepsek and pengawas to their special dashboard
    useEffect(() => {
        if (isKepsek || isPengawas) {
            router.push("/dashboard/kepala-sekolah")
        }
    }, [isKepsek, isPengawas, router])

    const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
    const [myWaliInfo, setMyWaliInfo] = useState<WaliKelas | null>(null)
    const [classSummary, setClassSummary] = useState<ClassSummary[]>([])
    const [stats, setStats] = useState({
        totalSiswa: 0,
        hadir: 0,
        tidakHadir: 0,
        jurnal: 0
    })

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch school info
                const schoolRes = await fetch("/api/settings/school")
                if (schoolRes.ok) {
                    const data = await schoolRes.json()
                    setSchoolInfo(data)
                }

                // Fetch current wali info (if teacher)
                if (userKelas) {
                    const waliRes = await fetch("/api/settings/wali-kelas")
                    if (waliRes.ok) {
                        const allWali = await waliRes.json()
                        const found = allWali.find((w: any) => w.kelas === userKelas)
                        if (found) setMyWaliInfo(found)
                    }
                }

                // Fetch stats based on role
                if (isAdmin || isGuruMapel) {
                    // Admin/Guru Mapel uses principal overview API for aggregated data
                    const overviewRes = await fetch("/api/principal/overview")
                    if (overviewRes.ok) {
                        const { overview, classSummary: cs } = await overviewRes.json()
                        setStats({
                            totalSiswa: overview.totalStudents,
                            hadir: overview.totalHadir,
                            tidakHadir: overview.totalTidakHadir,
                            jurnal: overview.totalJurnal
                        })
                        setClassSummary(cs || [])
                    }
                } else if (userKelas) {
                    // Guru uses individual class APIs
                    const kelasQuery = `?kelas=${userKelas}`
                    const d = new Date()
                    const year = d.getFullYear()
                    const month = String(d.getMonth() + 1).padStart(2, '0')
                    const day = String(d.getDate()).padStart(2, '0')
                    const today = `${year}-${month}-${day}`

                    const [siswaRes, jurnalRes, absensiRes] = await Promise.all([
                        fetch(`/api/siswa${kelasQuery}`),
                        fetch(`/api/jurnal${kelasQuery}`),
                        fetch(`/api/absensi?kelas=${userKelas}&tanggal=${today}`)
                    ])

                    if (siswaRes.ok) {
                        const siswaData = await siswaRes.json()
                        setStats(prev => ({ ...prev, totalSiswa: siswaData.length }))
                    }

                    if (jurnalRes.ok) {
                        const jurnalData = await jurnalRes.json()
                        setStats(prev => ({ ...prev, jurnal: jurnalData.length }))
                    }

                    if (absensiRes.ok) {
                        const absensiData = await absensiRes.json()
                        const uniqueStudents = new Set()
                        let hadirCount = 0
                        let tidakHadirCount = 0

                        absensiData.forEach((a: { siswaId: string, status: string }) => {
                            if (!uniqueStudents.has(a.siswaId)) {
                                uniqueStudents.add(a.siswaId)
                                if (a.status === "H") hadirCount++
                                else tidakHadirCount++
                            }
                        })

                        setStats(prev => ({ ...prev, hadir: hadirCount, tidakHadir: tidakHadirCount }))
                    }
                }
            } catch (error) {
                console.error("Dashboard fetch error:", error)
            }
        }
        if (session) fetchDashboardData()
    }, [session, userKelas, isAdmin, isGuruMapel])

    const quickActions = isAdmin ? [
        { href: "/dashboard/siswa", icon: "👥", label: "Data Siswa", desc: "Kelola semua siswa" },
        { href: "/dashboard/pengaturan", icon: "⚙️", label: "Pengaturan", desc: "Konfigurasi sistem" },
        { href: "/dashboard/rekap-absensi", icon: "📊", label: "Rekap Kehadiran", desc: "Laporan absensi" },
        { href: "/dashboard/rekap-nilai", icon: "📈", label: "Rekap Nilai", desc: "Laporan nilai" },
    ] : [
        { href: "/dashboard/absensi", icon: "📋", label: "Isi Absensi", desc: "Kelola kehadiran harian" },
        { href: "/dashboard/nilai", icon: "📝", label: "Input Nilai", desc: "Masukkan nilai siswa" },
        { href: "/dashboard/jurnal", icon: "📖", label: "Tulis Jurnal", desc: "Dokumentasi pembelajaran" },
        { href: "/dashboard/rekap-absensi", icon: "📊", label: "Rekap Kehadiran", desc: "Laporan bulanan/semester" },
    ]

    // Use actual teacher name if available, otherwise fallback to login name
    const welcomeName = myWaliInfo?.nama || session?.user?.name

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
                        Selamat Datang, {welcomeName?.split(' ')[0]}! 👋
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--accents-5)] mt-1">
                        {schoolInfo?.namaSekolah || "SDN 2 Nangerang"} • Tahun Ajaran {schoolInfo?.tahunAjaran || "2025/2026"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <span className="px-3 py-1.5 bg-black text-white text-xs font-semibold rounded-full">
                            🛡️ Admin
                        </span>
                    )}
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
                        {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon="users"
                    value={stats.totalSiswa}
                    label={isAdmin ? "Total Siswa Sekolah" : "Total Siswa"}
                    color="blue"
                />
                <StatCard
                    icon="clipboard-check"
                    value={stats.hadir || "-"}
                    label="Hadir Hari Ini"
                    color="emerald"
                />
                <StatCard
                    icon="alert-circle"
                    value={stats.tidakHadir || "-"}
                    label="Tidak Hadir"
                    color="red"
                />
                <StatCard
                    icon="book-open"
                    value={stats.jurnal}
                    label={isAdmin ? "Jurnal Bulan Ini" : "Total Jurnal"}
                    color="purple"
                />
            </div>

            {/* Admin: Class Summary Table */}
            {isAdmin && classSummary.length > 0 && (
                <div className="turbo-card overflow-hidden">
                    <div className="p-4 border-b border-[var(--border)] bg-[var(--accents-1)]">
                        <h2 className="text-lg font-semibold text-[var(--foreground)]">📊 Ringkasan Per Kelas</h2>
                        <p className="text-xs text-[var(--accents-5)] mt-1">Data kehadiran hari ini dan statistik per kelas</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]/50">
                                    <th className="px-4 py-3 text-left font-medium text-[var(--accents-5)]">Kelas</th>
                                    <th className="px-4 py-3 text-center font-medium text-[var(--accents-5)]">Siswa</th>
                                    <th className="px-4 py-3 text-center font-medium text-emerald-600">Hadir</th>
                                    <th className="px-4 py-3 text-center font-medium text-amber-600">Sakit</th>
                                    <th className="px-4 py-3 text-center font-medium text-blue-600">Izin</th>
                                    <th className="px-4 py-3 text-center font-medium text-red-600">Alpha</th>
                                    <th className="px-4 py-3 text-center font-medium text-purple-600">Jurnal</th>
                                    <th className="px-4 py-3 text-center font-medium text-[var(--accents-5)]">Rata²</th>
                                    <th className="px-4 py-3 text-right font-medium text-[var(--accents-5)]">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--border)]">
                                {classSummary.map((cs) => {
                                    const attendanceRate = cs.totalSiswa > 0
                                        ? Math.round((cs.hadir / cs.totalSiswa) * 100)
                                        : 0
                                    return (
                                        <tr key={cs.kelas} className="hover:bg-[var(--accents-1)] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center font-bold text-blue-700">
                                                        {cs.kelas}
                                                    </div>
                                                    <span className="font-medium text-[var(--foreground)]">Kelas {cs.kelas}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-semibold text-[var(--foreground)]">{cs.totalSiswa}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                    {cs.hadir}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cs.sakit > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {cs.sakit}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cs.izin > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {cs.izin}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cs.alpha > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {cs.alpha}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="text-purple-600 font-medium">{cs.jurnalBulanIni}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`font-bold ${cs.rataRataNilai >= 75 ? 'text-emerald-600' : cs.rataRataNilai >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                                                    {cs.rataRataNilai || '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Link
                                                        href={`/dashboard/rekap-absensi?kelas=${cs.kelas}`}
                                                        className="px-2 py-1 text-xs text-[var(--accents-5)] hover:text-black hover:bg-[var(--accents-2)] rounded transition-colors"
                                                    >
                                                        Absensi
                                                    </Link>
                                                    <Link
                                                        href={`/dashboard/rekap-nilai?kelas=${cs.kelas}`}
                                                        className="px-2 py-1 text-xs text-[var(--accents-5)] hover:text-black hover:bg-[var(--accents-2)] rounded transition-colors"
                                                    >
                                                        Nilai
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-[var(--accents-1)] border-t-2 border-[var(--border)]">
                                    <td className="px-4 py-3 font-bold text-[var(--foreground)]">Total</td>
                                    <td className="px-4 py-3 text-center font-bold text-[var(--foreground)]">
                                        {classSummary.reduce((sum, cs) => sum + cs.totalSiswa, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-emerald-600">
                                        {classSummary.reduce((sum, cs) => sum + cs.hadir, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-amber-600">
                                        {classSummary.reduce((sum, cs) => sum + cs.sakit, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-blue-600">
                                        {classSummary.reduce((sum, cs) => sum + cs.izin, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-red-600">
                                        {classSummary.reduce((sum, cs) => sum + cs.alpha, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-purple-600">
                                        {classSummary.reduce((sum, cs) => sum + cs.jurnalBulanIni, 0)}
                                    </td>
                                    <td className="px-4 py-3 text-center font-bold text-[var(--foreground)]">
                                        {Math.round(classSummary.reduce((sum, cs) => sum + cs.rataRataNilai, 0) / classSummary.filter(cs => cs.rataRataNilai > 0).length) || '-'}
                                    </td>
                                    <td className="px-4 py-3"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Quick Actions Section */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Aksi Cepat</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {quickActions.map((action) => (
                        <Link
                            key={action.href}
                            href={action.href}
                            className="turbo-card p-4 hover:border-black hover:shadow-md group transition-all duration-200"
                        >
                            <div className="flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--accents-1)] to-[var(--accents-2)] flex items-center justify-center text-2xl group-hover:scale-110 transition-transform border border-[var(--border)]">
                                    {action.icon}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-[var(--foreground)]">{action.label}</h4>
                                    <p className="text-xs text-[var(--accents-5)] mt-0.5 hidden sm:block">{action.desc}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Informasi Section - Horizontal Cards */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">Informasi</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Kepala Sekolah */}
                    <div className="turbo-card p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 flex items-center justify-center text-lg flex-shrink-0">
                            👨‍💼
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[var(--accents-5)] uppercase tracking-wider">Kepala Sekolah</p>
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{schoolInfo?.kepalaSekolah || "-"}</p>
                        </div>
                    </div>
                    {/* Wali Kelas / Role */}
                    <div className="turbo-card p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 text-purple-600 flex items-center justify-center text-lg flex-shrink-0">
                            {isAdmin ? "🛡️" : "👩‍🏫"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[var(--accents-5)] uppercase tracking-wider">
                                {isAdmin ? "Role Anda" : `Wali Kelas ${userKelas || "-"}`}
                            </p>
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">
                                {isAdmin ? "Administrator" : myWaliInfo?.nama || "-"}
                            </p>
                        </div>
                    </div>
                    {/* Tahun Ajaran */}
                    <div className="turbo-card p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 text-amber-600 flex items-center justify-center text-lg flex-shrink-0">
                            📅
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-[var(--accents-5)] uppercase tracking-wider">Tahun Ajaran</p>
                            <p className="text-sm font-medium text-[var(--foreground)] truncate">{schoolInfo?.tahunAjaran || "2025/2026"}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Admin: Additional Management Links */}
            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link href="/dashboard/perpustakaan" className="turbo-card p-5 flex items-center gap-4 hover:border-black hover:shadow-md transition-all group">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-200 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                            📚
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-cyan-700">Perpustakaan</h3>
                            <p className="text-sm text-[var(--accents-5)]">Kelola koleksi buku</p>
                        </div>
                        <svg className="w-5 h-5 text-[var(--accents-4)] group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>

                    <Link href="/dashboard/aset" className="turbo-card p-5 flex items-center gap-4 hover:border-black hover:shadow-md transition-all group">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                            📦
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-orange-700">Data Aset</h3>
                            <p className="text-sm text-[var(--accents-5)]">Inventaris barang</p>
                        </div>
                        <svg className="w-5 h-5 text-[var(--accents-4)] group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>

                    <Link href="/dashboard/absensi-guru" className="turbo-card p-5 flex items-center gap-4 hover:border-black hover:shadow-md transition-all group">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-100 to-teal-200 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                            ✅
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-teal-700">Absensi Guru</h3>
                            <p className="text-sm text-[var(--accents-5)]">Kehadiran pengajar</p>
                        </div>
                        <svg className="w-5 h-5 text-[var(--accents-4)] group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            )}

            {/* Teacher Links */}
            {!isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/dashboard/rekap-nilai" className="turbo-card p-5 flex items-center gap-4 hover:border-black hover:shadow-md transition-all group">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                            📈
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-emerald-700">Rekap Nilai</h3>
                            <p className="text-sm text-[var(--accents-5)]">Lihat rekapitulasi nilai siswa per semester</p>
                        </div>
                        <svg className="w-5 h-5 text-[var(--accents-4)] group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>

                    <Link href="/dashboard/siswa" className="turbo-card p-5 flex items-center gap-4 hover:border-black hover:shadow-md transition-all group">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center text-3xl group-hover:scale-105 transition-transform">
                            👥
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-[var(--foreground)] group-hover:text-blue-700">Data Siswa</h3>
                            <p className="text-sm text-[var(--accents-5)]">Kelola data siswa kelas {userKelas || "Anda"}</p>
                        </div>
                        <svg className="w-5 h-5 text-[var(--accents-4)] group-hover:text-black group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            )}
        </div>
    )
}

function StatCard({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
    const colorClasses: Record<string, string> = {
        blue: "from-blue-50 to-blue-100 text-blue-600 border-blue-200",
        emerald: "from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200",
        red: "from-red-50 to-red-100 text-red-600 border-red-200",
        purple: "from-purple-50 to-purple-100 text-purple-600 border-purple-200",
    }

    const iconMap: Record<string, React.ReactNode> = {
        users: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
        "clipboard-check": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
        "alert-circle": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
        "book-open": <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />,
    }

    return (
        <div className={`turbo-card p-4 sm:p-5 hover:shadow-md transition-all`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center border`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {iconMap[icon]}
                    </svg>
                </div>
            </div>
            <div>
                <p className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] tracking-tight">
                    {value === "-" ? "0" : value}
                </p>
                <p className="text-xs sm:text-sm text-[var(--accents-5)] font-medium mt-1">{label}</p>
            </div>
        </div>
    )
}
