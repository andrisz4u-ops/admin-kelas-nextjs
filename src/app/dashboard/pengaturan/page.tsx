"use client"

import { useState, useEffect } from "react"
import { getDefaultAcademicYear } from "@/lib/academicYear"
import { useSession } from "next-auth/react"
import { SchoolSettings, MyAccount, DbInfo, KenaikanPreview } from "@/components/pengaturan/types"
import { MyAccountSection } from "@/components/pengaturan/MyAccountSection"
import { SchoolSettingsSection } from "@/components/pengaturan/SchoolSettingsSection"
import { DatabaseSection } from "@/components/pengaturan/DatabaseSection"
import { KenaikanKelasSection } from "@/components/pengaturan/KenaikanKelasSection"

export default function PengaturanPage() {
    const { data: session, update } = useSession()
    const isAdmin = session?.user?.role === "admin"

    const [school, setSchool] = useState<SchoolSettings>({
        namaSekolah: "SDN 2 Nangerang",
        kepalaSekolah: "",
        nipKepsek: "",
        tahunAjaran: getDefaultAcademicYear(),
        semesterAktif: 1,
    })

    const [myAccount, setMyAccount] = useState<MyAccount>({
        name: "",
        username: "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
        fotoProfilUrl: ""
    })

    const [dbInfo, setDbInfo] = useState<DbInfo | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dbLoading, setDbLoading] = useState(false)

    // Kenaikan kelas state
    const [kenaikanPreview, setKenaikanPreview] = useState<KenaikanPreview | null>(null)
    const [kenaikanLoading, setKenaikanLoading] = useState(false)

    const [expanded, setExpanded] = useState({
        myAccount: true,
        school: false,
        kenaikanKelas: false,
        database: false
    })

    const toggle = (key: keyof typeof expanded) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const myAccountRes = await fetch("/api/settings/my-account")
                if (myAccountRes.ok) {
                    const data = await myAccountRes.json()
                    setMyAccount(prev => ({
                        ...prev,
                        name: data.name || "",
                        username: data.username || "",
                        nip: data.nip || "",
                        role: data.role || "",
                        kelas: data.kelas || null,
                        mapelDiampu: data.mapelDiampu || null,
                        fotoProfilUrl: data.fotoProfilUrl || ""
                    }))
                }

                if (isAdmin) {
                    const schoolRes = await fetch("/api/settings/school")
                    if (schoolRes.ok) {
                        const data = await schoolRes.json()
                        if (data) setSchool(data)
                    }
                }
            } catch {
                console.error("Failed to fetch settings")
            } finally {
                setLoading(false)
            }
        }
        if (session) fetchSettings()
    }, [session, isAdmin])

    const fetchDbInfo = async () => {
        setDbLoading(true)
        try {
            const res = await fetch("/api/settings/database")
            if (res.ok) {
                const data = await res.json()
                setDbInfo(data)
            }
        } catch {
            console.error("Failed to fetch database info")
        } finally {
            setDbLoading(false)
        }
    }

    const fetchKenaikanPreview = async () => {
        setKenaikanLoading(true)
        try {
            const res = await fetch("/api/siswa/kenaikan-kelas")
            if (res.ok) {
                const data = await res.json()
                setKenaikanPreview(data)
            }
        } catch {
            console.error("Failed to fetch kenaikan preview")
        } finally {
            setKenaikanLoading(false)
        }
    }

    if (loading) {
        return <div className="text-center text-[var(--accents-5)] py-12">Memuat pengaturan...</div>
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
                    {isAdmin ? "⚙️ Pengaturan Sistem & Akun" : "👤 Pengaturan Profil & Akun"}
                </h1>
                <p className="text-sm text-[var(--accents-5)]">
                    {isAdmin
                        ? "Kelola akun administrator, identitas sekolah, kenaikan kelas, dan database"
                        : "Kelola foto profil, identitas guru, dan kata sandi akun Anda"}
                </p>
            </div>

            {/* Profil & Akun Saya */}
            <MyAccountSection
                myAccount={myAccount}
                setMyAccount={setMyAccount}
                expanded={expanded.myAccount}
                onToggle={() => toggle('myAccount')}
                isAdmin={isAdmin}
                saving={saving}
                setSaving={setSaving}
                updateSession={update}
            />

            {isAdmin && (
                <>
                    {/* Informasi Sekolah */}
                    <SchoolSettingsSection
                        school={school}
                        setSchool={setSchool}
                        expanded={expanded.school}
                        onToggle={() => toggle('school')}
                        isAdmin={isAdmin}
                        saving={saving}
                        setSaving={setSaving}
                    />

                    {/* Maintenance Database */}
                    <DatabaseSection
                        dbInfo={dbInfo}
                        dbLoading={dbLoading}
                        expanded={expanded.database}
                        onToggle={() => {
                            toggle('database')
                            if (!dbInfo) fetchDbInfo()
                        }}
                        saving={saving}
                        setSaving={setSaving}
                        fetchDbInfo={fetchDbInfo}
                        onOpenKenaikanKelas={() => {
                            setExpanded(prev => ({ ...prev, kenaikanKelas: true }))
                            if (!kenaikanPreview) fetchKenaikanPreview()
                        }}
                    />

                    {/* Kenaikan Kelas */}
                    <KenaikanKelasSection
                        kenaikanPreview={kenaikanPreview}
                        kenaikanLoading={kenaikanLoading}
                        expanded={expanded.kenaikanKelas}
                        onToggle={() => toggle('kenaikanKelas')}
                        fetchKenaikanPreview={fetchKenaikanPreview}
                        setSchool={setSchool}
                    />
                </>
            )}
        </div>
    )
}
