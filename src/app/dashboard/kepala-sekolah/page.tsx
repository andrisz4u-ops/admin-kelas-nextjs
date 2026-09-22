"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import toast from "react-hot-toast"

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

interface Overview {
    totalStudents: number
    totalHadir: number
    totalTidakHadir: number
    totalJurnal: number
    date: string
}

export default function PrincipalDashboard() {
    const { data: session } = useSession()
    const router = useRouter()
    const isKepsek = session?.user?.role === "kepsek"
    const isAdmin = session?.user?.role === "admin"
    const isPengawas = session?.user?.role === "pengawas"
    const canAccess = isKepsek || isAdmin || isPengawas

    const [overview, setOverview] = useState<Overview | null>(null)
    const [classSummary, setClassSummary] = useState<ClassSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [schoolInfo, setSchoolInfo] = useState<{ namaSekolah?: string; tahunAjaran?: string } | null>(null)

    useEffect(() => {
        if (!canAccess) {
            router.push("/dashboard")
            return
        }

        const fetchData = async () => {
            try {
                const [overviewRes, schoolRes] = await Promise.all([
                    fetch("/api/principal/overview"),
                    fetch("/api/settings/school")
                ])
                if (overviewRes.ok) {
                    const data = await overviewRes.json()
                    setOverview(data.overview)
                    setClassSummary(data.classSummary)
                }
                if (schoolRes.ok) {
                    const sData = await schoolRes.json()
                    setSchoolInfo(sData)
                }
            } catch {
                toast.error("Gagal memuat data")
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [canAccess, router])

    if (!canAccess) return null

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        })
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
                        {isPengawas ? "Dashboard Pengawas Sekolah 🧐" : "Dashboard Kepala Sekolah 🏫"}
                    </h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        {isPengawas
                            ? `Supervisi & Pemantauan Akademik Seluruh Kelas • ${schoolInfo?.namaSekolah || "SDN 2 Nangerang"}`
                            : `${schoolInfo?.namaSekolah || "SDN 2 Nangerang"} • Tahun Ajaran ${schoolInfo?.tahunAjaran || "2025/2026"}`}
                    </p>
                </div>
                {overview && (
                    <span className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-full border border-blue-200">
                        {formatDate(overview.date)}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="text-center py-20 text-[var(--accents-5)]">Memuat data...</div>
            ) : (
                <>
                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <OverviewCard
                            icon="👥"
                            label="Total Siswa"
                            value={overview?.totalStudents || 0}
                            color="blue"
                        />
                        <OverviewCard
                            icon="✅"
                            label="Hadir Hari Ini"
                            value={overview?.totalHadir || 0}
                            color="emerald"
                        />
                        <OverviewCard
                            icon="⚠️"
                            label="Tidak Hadir"
                            value={overview?.totalTidakHadir || 0}
                            color="red"
                        />
                        <OverviewCard
                            icon="📖"
                            label="Jurnal Bulan Ini"
                            value={overview?.totalJurnal || 0}
                            color="purple"
                        />
                    </div>

                    {/* Per Class Summary */}
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Ringkasan Per Kelas</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {classSummary.map((cls) => (
                                <ClassCard key={cls.kelas} data={cls} />
                            ))}
                        </div>
                    </div>

                    {/* Attendance Chart Placeholder */}
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Perbandingan Kehadiran Hari Ini</h2>
                        <div className="turbo-card p-6">
                            <div className="flex items-end gap-3 h-48">
                                {classSummary.map((cls) => {
                                    const total = cls.hadir + cls.sakit + cls.izin + cls.alpha
                                    const percentage = total > 0 ? Math.round((cls.hadir / cls.totalSiswa) * 100) : 0
                                    return (
                                        <div key={cls.kelas} className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-[var(--accents-2)] rounded-t-lg relative" style={{ height: '140px' }}>
                                                <div
                                                    className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-lg transition-all"
                                                    style={{ height: `${percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-[var(--foreground)]">{percentage}%</span>
                                            <span className="text-xs text-[var(--accents-5)]">Kelas {cls.kelas}</span>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                    <span className="text-[var(--accents-5)]">Persentase Kehadiran</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Grade Comparison */}
                    <div>
                        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-4">Rata-rata Nilai Per Kelas</h2>
                        <div className="turbo-card p-6">
                            <div className="flex items-end gap-3 h-48">
                                {classSummary.map((cls) => {
                                    const percentage = Math.min(cls.rataRataNilai, 100)
                                    return (
                                        <div key={cls.kelas} className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full bg-[var(--accents-2)] rounded-t-lg relative" style={{ height: '140px' }}>
                                                <div
                                                    className="absolute bottom-0 w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg transition-all"
                                                    style={{ height: `${percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-bold text-[var(--foreground)]">{cls.rataRataNilai}</span>
                                            <span className="text-xs text-[var(--accents-5)]">Kelas {cls.kelas}</span>
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="mt-4 flex items-center justify-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                                    <span className="text-[var(--accents-5)]">Rata-rata Nilai</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function OverviewCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
    const colorClasses: Record<string, string> = {
        blue: "from-blue-50 to-blue-100 border-blue-200",
        emerald: "from-emerald-50 to-emerald-100 border-emerald-200",
        red: "from-red-50 to-red-100 border-red-200",
        purple: "from-purple-50 to-purple-100 border-purple-200",
    }

    return (
        <div className={`turbo-card p-5 bg-gradient-to-br ${colorClasses[color]}`}>
            <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{icon}</span>
            </div>
            <p className="text-3xl font-bold text-[var(--foreground)]">{value}</p>
            <p className="text-sm text-[var(--accents-5)] mt-1">{label}</p>
        </div>
    )
}

function ClassCard({ data }: { data: ClassSummary }) {
    const attendancePercentage = data.totalSiswa > 0
        ? Math.round((data.hadir / data.totalSiswa) * 100)
        : 0

    return (
        <div className="turbo-card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-[var(--foreground)]">Kelas {data.kelas}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${attendancePercentage >= 90 ? "bg-emerald-100 text-emerald-700" :
                    attendancePercentage >= 75 ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                    }`}>
                    {attendancePercentage}% hadir
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">👥</span>
                    <div>
                        <p className="text-[var(--accents-5)]">Siswa</p>
                        <p className="font-bold text-[var(--foreground)]">{data.totalSiswa}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">✓</span>
                    <div>
                        <p className="text-[var(--accents-5)]">Hadir</p>
                        <p className="font-bold text-emerald-600">{data.hadir}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">✗</span>
                    <div>
                        <p className="text-[var(--accents-5)]">Tidak Hadir</p>
                        <p className="font-bold text-red-600">{data.sakit + data.izin + data.alpha}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">📖</span>
                    <div>
                        <p className="text-[var(--accents-5)]">Jurnal</p>
                        <p className="font-bold text-[var(--foreground)]">{data.jurnalBulanIni}</p>
                    </div>
                </div>
            </div>

            {data.rataRataNilai > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-[var(--accents-5)]">Rata-rata Nilai</span>
                        <span className={`text-lg font-bold ${data.rataRataNilai >= 80 ? "text-emerald-600" :
                            data.rataRataNilai >= 70 ? "text-amber-600" :
                                "text-red-600"
                            }`}>{data.rataRataNilai}</span>
                    </div>
                </div>
            )}

            {/* Direct Supervisi Links */}
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
                <p className="text-[11px] font-semibold text-[var(--accents-5)] uppercase tracking-wider mb-2">Supervisi Kelas {data.kelas}</p>
                <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
                    <Link
                        href={`/dashboard/jurnal?kelas=${data.kelas}`}
                        className="px-2 py-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-center truncate flex items-center justify-center gap-1"
                    >
                        <span>📖</span> Jurnal
                    </Link>
                    <Link
                        href={`/dashboard/absensi?kelas=${data.kelas}`}
                        className="px-2 py-1.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-center truncate flex items-center justify-center gap-1"
                    >
                        <span>📋</span> Presensi
                    </Link>
                    <Link
                        href={`/dashboard/nilai?kelas=${data.kelas}`}
                        className="px-2 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-center truncate flex items-center justify-center gap-1"
                    >
                        <span>📊</span> Nilai
                    </Link>
                    <Link
                        href={`/dashboard/siswa?kelas=${data.kelas}`}
                        className="px-2 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-center truncate flex items-center justify-center gap-1"
                    >
                        <span>👥</span> Siswa
                    </Link>
                </div>
            </div>
        </div>
    )
}
