"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"

interface SubjectStats {
    avg: number
    min: number
    max: number
    count: number
}

interface StudentRank {
    id: string
    nama: string
    avg: number
    gradeCount: number
}

interface StudentDetail {
    id: string
    nama: string
    rank: number
    totalStudents: number
    overallAvg: number
    subjectAverages: {
        mapel: string
        avg: number
        grades: Record<string, number>
    }[]
}

interface AnalyticsData {
    kelas: number
    totalStudents: number
    totalGrades: number
    overallClassAvg: number
    subjects: string[]
    gradeTypes: string[]
    subjectStats: Record<string, SubjectStats>
    topStudents: StudentRank[]
    bottomStudents: StudentRank[]
    distribution: {
        excellent: number
        good: number
        average: number
        belowAverage: number
        poor: number
    }
    students: { id: string; nama: string }[]
    studentDetail?: StudentDetail
}

export default function AnalitikNilaiPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [kelas, setKelas] = useState(userKelas || 1)
    const [semester, setSemester] = useState(1)
    const [data, setData] = useState<AnalyticsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const qKelas = params.get("kelas")
            if (qKelas && [1, 2, 3, 4, 5, 6].includes(Number(qKelas))) {
                setKelas(Number(qKelas))
            }
        }
        if (!canSelectKelas && userKelas) {
            setKelas(userKelas)
        }

        // Ambil semester aktif dari pengaturan sekolah
        fetch("/api/settings/school")
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data?.semesterAktif) {
                    setSemester(Number(data.semesterAktif))
                }
            })
            .catch(() => {})
    }, [canSelectKelas, userKelas])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                kelas: kelas.toString(),
                semester: semester.toString()
            })
            if (selectedStudent) params.append("siswaId", selectedStudent)

            const res = await fetch(`/api/analytics/nilai?${params}`)
            if (res.ok) {
                const result = await res.json()
                setData(result)
            }
        } catch {
            toast.error("Gagal memuat data")
        } finally {
            setLoading(false)
        }
    }, [kelas, semester, selectedStudent])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const getGradeColor = (value: number) => {
        if (value >= 90) return "text-emerald-600"
        if (value >= 80) return "text-blue-600"
        if (value >= 70) return "text-amber-600"
        return "text-red-600"
    }

    const getGradeBg = (value: number) => {
        if (value >= 90) return "bg-emerald-100 text-emerald-700"
        if (value >= 80) return "bg-blue-100 text-blue-700"
        if (value >= 70) return "bg-amber-100 text-amber-700"
        return "bg-red-100 text-red-700"
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                        Analitik Nilai 📊
                    </h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        Analisis performa nilai siswa per kelas
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {canSelectKelas ? (
                        <div className="relative">
                            <select
                                value={kelas}
                                onChange={(e) => {
                                    setKelas(Number(e.target.value))
                                    setSelectedStudent(null)
                                }}
                                className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                            >
                                {[1, 2, 3, 4, 5, 6].map((k) => (<option key={k} value={k}>Kelas {k}</option>))}
                            </select>
                        </div>
                    ) : (
                        <span className="h-9 px-3 flex items-center bg-[var(--accents-2)] rounded-md text-sm font-medium">
                            Kelas {kelas}
                        </span>
                    )}
                    {/* Semester selector */}
                    <div className="relative">
                        <select
                            value={semester}
                            onChange={(e) => setSemester(Number(e.target.value))}
                            className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                        >
                            <option value={1}>Semester 1</option>
                            <option value={2}>Semester 2</option>
                        </select>
                    </div>
                    {data && data.students.length > 0 && (
                        <div className="relative">
                            <select
                                value={selectedStudent || ""}
                                onChange={(e) => setSelectedStudent(e.target.value || null)}
                                className="h-9 pl-3 pr-8 bg-white border border-[var(--border)] rounded-md text-sm outline-none focus:ring-1 focus:ring-black cursor-pointer appearance-none"
                            >
                                <option value="">Semua Siswa</option>
                                {data.students.map((s) => (
                                    <option key={s.id} value={s.id}>{s.nama}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-[var(--accents-5)]">Memuat data...</div>
            ) : !data ? (
                <div className="text-center py-20 text-[var(--accents-5)]">Tidak ada data</div>
            ) : selectedStudent && data.studentDetail ? (
                /* Student Detail View */
                <StudentDetailView detail={data.studentDetail} gradeTypes={data.gradeTypes} />
            ) : (
                /* Class Overview */
                <>
                    {/* Overview Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="turbo-card p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                            <p className="text-sm text-[var(--accents-5)]">Total Siswa</p>
                            <p className="text-3xl font-bold text-blue-700">{data.totalStudents}</p>
                        </div>
                        <div className="turbo-card p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                            <p className="text-sm text-[var(--accents-5)]">Total Nilai</p>
                            <p className="text-3xl font-bold text-purple-700">{data.totalGrades}</p>
                        </div>
                        <div className="turbo-card p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                            <p className="text-sm text-[var(--accents-5)]">Rata-rata Kelas</p>
                            <p className="text-3xl font-bold text-emerald-700">{data.overallClassAvg}</p>
                        </div>
                        <div className="turbo-card p-5 bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                            <p className="text-sm text-[var(--accents-5)]">Mata Pelajaran</p>
                            <p className="text-3xl font-bold text-amber-700">{data.subjects.length}</p>
                        </div>
                    </div>

                    {/* Grade Distribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="turbo-card p-5">
                            <h3 className="font-semibold text-[var(--foreground)] mb-4">Distribusi Nilai</h3>
                            <div className="space-y-3">
                                {[
                                    { label: "Sangat Baik (≥90)", count: data.distribution.excellent, color: "bg-emerald-500" },
                                    { label: "Baik (80-89)", count: data.distribution.good, color: "bg-blue-500" },
                                    { label: "Cukup (70-79)", count: data.distribution.average, color: "bg-amber-500" },
                                    { label: "Kurang (60-69)", count: data.distribution.belowAverage, color: "bg-orange-500" },
                                    { label: "Perlu Perhatian (<60)", count: data.distribution.poor, color: "bg-red-500" },
                                ].map((item) => {
                                    const percentage = data.totalGrades > 0 ? Math.round((item.count / data.totalGrades) * 100) : 0
                                    return (
                                        <div key={item.label} className="flex items-center gap-3">
                                            <span className="text-sm text-[var(--accents-5)] w-40">{item.label}</span>
                                            <div className="flex-1 bg-[var(--accents-2)] rounded-full h-6 relative">
                                                <div className={`h-6 rounded-full ${item.color}`} style={{ width: `${percentage}%` }} />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                                    {item.count} ({percentage}%)
                                                </span>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Subject Stats */}
                        <div className="turbo-card p-5">
                            <h3 className="font-semibold text-[var(--foreground)] mb-4">Rata-rata Per Mapel</h3>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {Object.entries(data.subjectStats).map(([mapel, stats]) => (
                                    <div key={mapel} className="flex items-center justify-between p-2 bg-[var(--accents-1)] rounded-lg">
                                        <span className="text-sm font-medium text-[var(--foreground)]">{mapel}</span>
                                        <div className="flex items-center gap-3 text-sm">
                                            <span className="text-[var(--accents-5)]">Min: {stats.min}</span>
                                            <span className={`font-bold ${getGradeColor(stats.avg)}`}>{stats.avg}</span>
                                            <span className="text-[var(--accents-5)]">Max: {stats.max}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Rankings */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Students */}
                        <div className="turbo-card p-5">
                            <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                <span>🏆</span> Top 5 Siswa
                            </h3>
                            <div className="space-y-2">
                                {data.topStudents.map((student, i) => (
                                    <div
                                        key={student.id}
                                        onClick={() => setSelectedStudent(student.id)}
                                        className="flex items-center gap-3 p-3 bg-[var(--accents-1)] rounded-lg hover:bg-[var(--accents-2)] cursor-pointer transition-colors"
                                    >
                                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? "bg-amber-400 text-white" :
                                                i === 1 ? "bg-gray-300 text-gray-700" :
                                                    i === 2 ? "bg-orange-400 text-white" :
                                                        "bg-[var(--accents-2)] text-[var(--accents-5)]"
                                            }`}>
                                            {i + 1}
                                        </span>
                                        <span className="flex-1 text-sm font-medium text-[var(--foreground)] truncate">{student.nama}</span>
                                        <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeBg(student.avg)}`}>
                                            {student.avg}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Students Needing Attention */}
                        <div className="turbo-card p-5">
                            <h3 className="font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                <span>⚠️</span> Perlu Perhatian
                            </h3>
                            <div className="space-y-2">
                                {data.bottomStudents.map((student, i) => (
                                    <div
                                        key={student.id}
                                        onClick={() => setSelectedStudent(student.id)}
                                        className="flex items-center gap-3 p-3 bg-red-50 rounded-lg hover:bg-red-100 cursor-pointer transition-colors"
                                    >
                                        <span className="w-8 h-8 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-sm font-bold">
                                            {data.totalStudents - i}
                                        </span>
                                        <span className="flex-1 text-sm font-medium text-[var(--foreground)] truncate">{student.nama}</span>
                                        <span className={`px-2 py-1 rounded text-sm font-bold ${getGradeBg(student.avg)}`}>
                                            {student.avg}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

function StudentDetailView({ detail, gradeTypes }: { detail: StudentDetail; gradeTypes: string[] }) {
    return (
        <div className="space-y-6">
            {/* Student Header */}
            <div className="turbo-card p-6 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-[var(--foreground)]">{detail.nama}</h2>
                        <p className="text-sm text-[var(--accents-5)]">
                            Peringkat {detail.rank} dari {detail.totalStudents} siswa
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-center">
                            <p className="text-3xl font-bold text-blue-600">{detail.overallAvg}</p>
                            <p className="text-xs text-[var(--accents-5)]">Rata-rata</p>
                        </div>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                            #{detail.rank}
                        </div>
                    </div>
                </div>
            </div>

            {/* Subject Grades Table */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[var(--border)] bg-[var(--accents-1)]">
                                <th className="px-4 py-3 text-left font-medium text-[var(--accents-5)]">Mata Pelajaran</th>
                                {gradeTypes.map(type => (
                                    <th key={type} className="px-4 py-3 text-center font-medium text-[var(--accents-5)] w-16">{type}</th>
                                ))}
                                <th className="px-4 py-3 text-center font-medium text-[var(--accents-5)] w-20">Rata-rata</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                            {detail.subjectAverages.map(subj => (
                                <tr key={subj.mapel} className="hover:bg-[var(--accents-1)]">
                                    <td className="px-4 py-3 font-medium text-[var(--foreground)]">{subj.mapel}</td>
                                    {gradeTypes.map(type => (
                                        <td key={type} className="px-4 py-3 text-center">
                                            {subj.grades[type] !== undefined ? (
                                                <span className={subj.grades[type] >= 70 ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                                                    {subj.grades[type]}
                                                </span>
                                            ) : (
                                                <span className="text-[var(--accents-4)]">-</span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-center">
                                        <span className={`px-2 py-1 rounded text-sm font-bold ${subj.avg >= 90 ? "bg-emerald-100 text-emerald-700" :
                                                subj.avg >= 80 ? "bg-blue-100 text-blue-700" :
                                                    subj.avg >= 70 ? "bg-amber-100 text-amber-700" :
                                                        "bg-red-100 text-red-700"
                                            }`}>
                                            {subj.avg}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Performance Chart */}
            <div className="turbo-card p-5">
                <h3 className="font-semibold text-[var(--foreground)] mb-4">Grafik Nilai Per Mapel</h3>
                <div className="flex items-end gap-2 h-48">
                    {detail.subjectAverages.map((subj) => (
                        <div key={subj.mapel} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full bg-[var(--accents-2)] rounded-t-lg relative" style={{ height: '140px' }}>
                                <div
                                    className={`absolute bottom-0 w-full rounded-t-lg transition-all ${subj.avg >= 90 ? "bg-gradient-to-t from-emerald-500 to-emerald-400" :
                                            subj.avg >= 80 ? "bg-gradient-to-t from-blue-500 to-blue-400" :
                                                subj.avg >= 70 ? "bg-gradient-to-t from-amber-500 to-amber-400" :
                                                    "bg-gradient-to-t from-red-500 to-red-400"
                                        }`}
                                    style={{ height: `${subj.avg}%` }}
                                />
                            </div>
                            <span className="text-xs font-bold text-[var(--foreground)]">{subj.avg}</span>
                            <span className="text-[10px] text-[var(--accents-5)] text-center truncate w-full" title={subj.mapel}>
                                {subj.mapel.length > 8 ? subj.mapel.substring(0, 6) + ".." : subj.mapel}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
