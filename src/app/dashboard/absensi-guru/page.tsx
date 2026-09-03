"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"
import { getWIBDateString, getWIBMonthString } from "@/lib/dateUtils"

interface TeacherAttendance {
    userId: string
    userName: string
    waktuDatang: string
    ttdDatang: string
    waktuPulang: string
    ttdPulang: string
}

interface Teacher {
    id: string
    name: string
    role: string
    kelas: number | null
}

const getRoleBadge = (role: string, kelas: number | null) => {
    if (role === "admin") return "Administrator"
    if (role === "guru_mapel") return "Guru Mapel"
    if (kelas) return `Wali Kelas ${kelas}`
    return "Wali Kelas"
}

function getRoleLabel(teacher: Teacher) {
    if (teacher.name.toLowerCase().includes("holid")) return "Penjaga Sekolah"
    if (teacher.role === "admin") return "Operator"
    if (teacher.role === "kepsek") return "Kepala Sekolah"
    if (teacher.role === "pengawas") return "Pengawas"
    if (teacher.role === "guru_mapel") return "Guru Mapel"
    return "Wali Kelas"
}

export default function AbsensiGuruPage() {
    const { data: session } = useSession()
    const router = useRouter()
    const isAdmin = session?.user?.role === "admin"

    const [tanggal, setTanggal] = useState(getWIBDateString())
    const [bulan, setBulan] = useState(getWIBMonthString())
    const [teachers, setTeachers] = useState<Teacher[]>([])
    const [attendance, setAttendance] = useState<TeacherAttendance[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeSignature, setActiveSignature] = useState<{ userId: string; type: "datang" | "pulang" } | null>(null)

    // Redirect non-admin
    useEffect(() => {
        if (session && !isAdmin) {
            toast.error("Akses ditolak. Hanya admin yang bisa mengakses halaman ini.")
            router.push("/dashboard")
        }
    }, [session, isAdmin, router])

    // Fetch teachers and attendance
    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const [teachersRes, attendanceRes] = await Promise.all([
                fetch("/api/users?role=guru,guru_mapel,kepsek,admin"),
                fetch(`/api/absensi-guru?tanggal=${tanggal}`)
            ])

            if (teachersRes.ok) {
                const data = await teachersRes.json()

                // Custom sort order requested by user
                const PRIORITY_NAMES = [
                    "Ujang", // Kepala Sekolah
                    "Kuraesin",
                    "Kurnia", // Matches Kurnia Ningsih
                    "Endang Hermawan",
                    "Niken Fatmawati",
                    "Ade Setiawati",
                    "Andris Hadiansyah",
                    "Yani Herfiana",
                    "Cecep Rif'at",
                    "Holid Ahsanudin",
                    "Sarah Salsabila"
                ];

                const sortedData = data.sort((a: Teacher, b: Teacher) => {
                    const getIndex = (name: string) => {
                        return PRIORITY_NAMES.findIndex(p =>
                            name.toLowerCase().includes(p.toLowerCase()) ||
                            p.toLowerCase().includes(name.toLowerCase())
                        );
                    };

                    const indexA = getIndex(a.name);
                    const indexB = getIndex(b.name);

                    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                    if (indexA !== -1) return -1;
                    if (indexB !== -1) return 1;
                    return a.name.localeCompare(b.name);
                });

                setTeachers(sortedData)
            }

            if (attendanceRes.ok) {
                const data = await attendanceRes.json()
                // Merge with teachers
                setAttendance(data)
            }
        } catch {
            console.error("Failed to fetch data")
        } finally {
            setLoading(false)
        }
    }, [tanggal])

    useEffect(() => {
        if (isAdmin) fetchData()
    }, [isAdmin, fetchData])

    const updateAttendance = (userId: string, field: keyof TeacherAttendance, value: string) => {
        setAttendance(prev => {
            const existing = prev.find(a => a.userId === userId)
            if (existing) {
                return prev.map(a => a.userId === userId ? { ...a, [field]: value } : a)
            }
            const teacher = teachers.find(t => t.id === userId)
            return [...prev, {
                userId,
                userName: teacher?.name || "",
                waktuDatang: field === "waktuDatang" ? value : "",
                ttdDatang: field === "ttdDatang" ? value : "",
                waktuPulang: field === "waktuPulang" ? value : "",
                ttdPulang: field === "ttdPulang" ? value : "",
            }]
        })
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/absensi-guru", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tanggal, attendance }),
            })
            if (res.ok) toast.success("Absensi guru berhasil disimpan!")
            else toast.error("Gagal menyimpan")
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const handleExportDaily = async () => {
        try {
            const res = await fetch("/api/absensi-guru/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tanggal, type: "daily" }),
            })
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `absensi-guru-${tanggal}.xlsx`
                a.click()
                window.URL.revokeObjectURL(url)
                toast.success("Excel Harian berhasil diunduh!")
            } else {
                toast.error("Gagal export Excel")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        }
    }

    const handleExportMonthly = async () => {
        try {
            const res = await fetch("/api/absensi-guru/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bulan, type: "monthly" }),
            })
            if (res.ok) {
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `rekap-absensi-${bulan}.xlsx`
                a.click()
                window.URL.revokeObjectURL(url)
                toast.success("Excel Bulanan berhasil diunduh!")
            } else {
                toast.error("Gagal export Excel")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        }
    }

    const getAttendanceForTeacher = (userId: string): TeacherAttendance | undefined => {
        return attendance.find(a => a.userId === userId)
    }

    if (!isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <span className="text-6xl">🔒</span>
                    <p className="text-lg text-[var(--accents-5)] mt-4">Hanya admin yang dapat mengakses halaman ini</p>
                </div>
            </div>
        )
    }

    if (loading) {
        return <div className="text-center text-[var(--accents-5)] py-12">Memuat data...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Daftar Hadir Guru</h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">Absensi harian guru dan staff pengajar</p>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                    {/* Harian */}
                    <div className="flex items-center gap-2 p-1 border border-[var(--border)] rounded-md bg-[var(--accents-1)]/30">
                        <input
                            type="date"
                            value={tanggal}
                            onChange={(e) => setTanggal(e.target.value)}
                            className="h-8 px-2 bg-transparent text-sm text-[var(--foreground)] outline-none w-32 cursor-pointer"
                        />
                        <button
                            onClick={handleExportDaily}
                            className="h-8 px-3 bg-black text-white rounded text-xs font-medium hover:bg-gray-800 transition-colors"
                            title="Download Laporan Harian"
                        >
                            Harian
                        </button>
                    </div>

                    {/* Bulanan */}
                    <div className="flex items-center gap-2 p-1 border border-[var(--border)] rounded-md bg-[var(--accents-1)]/30">
                        <input
                            type="month"
                            value={bulan}
                            onChange={(e) => setBulan(e.target.value)}
                            className="h-8 px-2 bg-transparent text-sm text-[var(--foreground)] outline-none w-32 cursor-pointer"
                        />
                        <button
                            onClick={handleExportMonthly}
                            className="h-8 px-3 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700 transition-colors"
                            title="Download Rekap Bulanan"
                        >
                            Bulanan
                        </button>
                    </div>
                </div>
            </div>

            {/* Attendance Table */}
            <div className="turbo-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-[var(--accents-1)] border-b border-[var(--border)]">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--accents-6)]">No</th>
                                <th className="text-left px-4 py-3 font-semibold text-[var(--accents-6)]">Nama Guru</th>
                                <th className="text-center px-4 py-3 font-semibold text-[var(--accents-6)]">Waktu Datang</th>
                                <th className="text-center px-4 py-3 font-semibold text-[var(--accents-6)]">TTD Datang</th>
                                <th className="text-center px-4 py-3 font-semibold text-[var(--accents-6)]">Waktu Pulang</th>
                                <th className="text-center px-4 py-3 font-semibold text-[var(--accents-6)]">TTD Pulang</th>
                            </tr>
                        </thead>
                        <tbody>
                            {teachers.map((teacher, idx) => {
                                const att = getAttendanceForTeacher(teacher.id)
                                return (
                                    <tr key={teacher.id} className="border-b border-[var(--border)] hover:bg-[var(--accents-1)]/50">
                                        <td className="px-4 py-3 text-[var(--foreground)]">{idx + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-[var(--foreground)]">{teacher.name}</div>
                                            <div className="text-xs text-[var(--accents-5)]">
                                                {getRoleLabel(teacher)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="time"
                                                value={att?.waktuDatang || ""}
                                                onChange={(e) => updateAttendance(teacher.id, "waktuDatang", e.target.value)}
                                                className="h-8 px-2 bg-white border border-[var(--border)] rounded text-sm text-center"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setActiveSignature({ userId: teacher.id, type: "datang" })}
                                                className={`h-8 px-3 rounded text-sm font-medium transition-colors ${att?.ttdDatang
                                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                    : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {att?.ttdDatang ? "✓ Sudah" : "Tanda Tangan"}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <input
                                                type="time"
                                                value={att?.waktuPulang || ""}
                                                onChange={(e) => updateAttendance(teacher.id, "waktuPulang", e.target.value)}
                                                className="h-8 px-2 bg-white border border-[var(--border)] rounded text-sm text-center"
                                            />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setActiveSignature({ userId: teacher.id, type: "pulang" })}
                                                className={`h-8 px-3 rounded text-sm font-medium transition-colors ${att?.ttdPulang
                                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                    : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                                                    }`}
                                            >
                                                {att?.ttdPulang ? "✓ Sudah" : "Tanda Tangan"}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {teachers.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--accents-5)]">
                                        Tidak ada data guru
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="h-10 px-6 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    {saving ? "Menyimpan..." : "Simpan Absensi"}
                </button>
            </div>

            {/* Signature Modal */}
            {activeSignature && (
                <SignatureModal
                    onClose={() => setActiveSignature(null)}
                    onSave={(signature) => {
                        const field = activeSignature.type === "datang" ? "ttdDatang" : "ttdPulang"
                        updateAttendance(activeSignature.userId, field, signature)
                        setActiveSignature(null)
                    }}
                    title={`Tanda Tangan ${activeSignature.type === "datang" ? "Datang" : "Pulang"}`}
                />
            )}
        </div>
    )
}

function SignatureModal({ onClose, onSave, title }: { onClose: () => void; onSave: (signature: string) => void; title: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [isDrawing, setIsDrawing] = useState(false)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.strokeStyle = "black"
        ctx.lineWidth = 2
        ctx.lineCap = "round"
    }, [])

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true)
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
        const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
        ctx.beginPath()
        ctx.moveTo(x, y)
    }

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing) return
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        const rect = canvas.getBoundingClientRect()
        const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
        const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top
        ctx.lineTo(x, y)
        ctx.stroke()
    }

    const stopDrawing = () => {
        setIsDrawing(false)
    }

    const clearCanvas = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const saveSignature = () => {
        const canvas = canvasRef.current
        if (!canvas) return
        const dataUrl = canvas.toDataURL("image/png")
        onSave(dataUrl)
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[var(--border)] rounded-lg shadow-2xl w-full max-w-md">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--accents-1)]">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button onClick={onClose} className="text-[var(--accents-5)] hover:text-black">✕</button>
                </div>
                <div className="p-4">
                    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
                        <canvas
                            ref={canvasRef}
                            width={350}
                            height={150}
                            className="w-full cursor-crosshair touch-none"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                    </div>
                    <p className="text-xs text-[var(--accents-5)] mt-2 text-center">
                        Gambar tanda tangan di atas
                    </p>
                </div>
                <div className="p-4 border-t border-[var(--border)] flex gap-3">
                    <button onClick={clearCanvas} className="flex-1 h-10 border border-[var(--border)] rounded-md text-sm font-medium hover:bg-[var(--accents-1)]">
                        Hapus
                    </button>
                    <button onClick={saveSignature} className="flex-1 h-10 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800">
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    )
}
