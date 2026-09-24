"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import toast from "react-hot-toast"
import { RekapSiswa, RekapMeta } from "@/components/rekap-absensi/types"
import { exportRekapToExcel } from "@/components/rekap-absensi/exportExcel"
import { RekapFilterBar } from "@/components/rekap-absensi/RekapFilterBar"
import { RekapTable } from "@/components/rekap-absensi/RekapTable"
import { RekapInfoCard } from "@/components/rekap-absensi/RekapInfoCard"

export default function RekapAbsensiPage() {
    const { data: session } = useSession()
    const isAdmin = session?.user?.role === "admin"
    const isPengawas = session?.user?.role === "pengawas"
    const isKepsek = session?.user?.role === "kepsek"
    const canSelectKelas = isAdmin || isPengawas || isKepsek
    const userKelas = session?.user?.kelas

    const [recap, setRecap] = useState<RekapSiswa[]>([])
    const [meta, setMeta] = useState<RekapMeta | null>(null)
    const [loading, setLoading] = useState(false)
    const [kelas, setKelas] = useState(userKelas || 1)
    const [type, setType] = useState<"month" | "semester">("month")
    const [month, setMonth] = useState(new Date().getMonth())
    const [year, setYear] = useState(new Date().getFullYear())
    const [tahunAjaran, setTahunAjaran] = useState("2026/2027")
    const [semester, setSemester] = useState(1)

    useEffect(() => {
        fetch("/api/settings/school")
            .then(res => res.json())
            .then(data => {
                if (data?.tahunAjaran) setTahunAjaran(data.tahunAjaran)
                if (data?.semesterAktif) setSemester(Number(data.semesterAktif))
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search)
            const qKelas = params.get("kelas")
            if (qKelas && [1, 2, 3, 4, 5, 6].includes(Number(qKelas))) {
                setKelas(Number(qKelas))
                return
            }
        }
        if (!canSelectKelas && userKelas) {
            setKelas(userKelas)
        }
    }, [canSelectKelas, userKelas])

    const fetchData = useCallback(async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({
                kelas: kelas.toString(),
                type,
                month: month.toString(),
                year: year.toString(),
                semester: semester.toString(),
                tahunAjaran,
            })
            const res = await fetch(`/api/rekap/absensi?${params}`, { cache: "no-store" })
            const data = await res.json()
            setRecap(data.recap || [])
            setMeta(data.meta || null)
        } catch {
            toast.error("Gagal memuat data rekap")
        } finally {
            setLoading(false)
        }
    }, [kelas, type, month, year, semester, tahunAjaran])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleExport = () => {
        exportRekapToExcel({
            recap,
            meta,
            type,
            month,
            year,
            semester,
            kelas,
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">Rekapitulasi Kehadiran</h1>
                    <p className="text-sm text-[var(--accents-5)] mt-1">
                        Berdasarkan Kalender Pendidikan Kab. Purwakarta (Tahun Ajaran {tahunAjaran})
                    </p>
                </div>
                <RekapFilterBar
                    kelas={kelas}
                    setKelas={setKelas}
                    canSelectKelas={canSelectKelas}
                    type={type}
                    setType={setType}
                    month={month}
                    setMonth={setMonth}
                    year={year}
                    setYear={setYear}
                    semester={semester}
                    setSemester={setSemester}
                    tahunAjaran={tahunAjaran}
                    setTahunAjaran={setTahunAjaran}
                    onExport={handleExport}
                />
            </div>

            {/* Info Card */}
            {meta && <RekapInfoCard meta={meta} />}

            {/* Table */}
            <RekapTable recap={recap} loading={loading} />
        </div>
    )
}
