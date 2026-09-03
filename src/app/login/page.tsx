"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

export const dynamic = 'force-dynamic'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")
    const [tahunAjaran, setTahunAjaran] = useState("2025/2026")

    useEffect(() => {
        fetch("/api/settings/school")
            .then(res => res.json())
            .then(data => {
                if (data?.tahunAjaran) setTahunAjaran(data.tahunAjaran)
            })
            .catch(() => {})
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await signIn("credentials", {
                username,
                password,
                redirect: false,
            })

            if (res?.error) {
                toast.error("Username atau password salah")
            } else {
                toast.success("Berhasil masuk!")
                router.push("/dashboard")
                router.refresh()
            }
        } catch {
            toast.error("Terjadi kesalahan, coba lagi")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white p-2.5 mb-4 shadow-md border border-gray-100">
                        <img
                            src="/logo-sekolah.png"
                            alt="Logo SDN 2 Nangerang"
                            className="w-full h-full object-contain"
                        />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Sistem Informasi Kelas</h1>
                    <p className="text-sm text-gray-500 mt-1">SDN 2 Nangerang &bull; Masuk untuk mengelola data</p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Masukkan username"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-black text-white font-semibold rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all disabled:opacity-50 text-sm shadow-md"
                        >
                            {loading ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Memproses...
                                </span>
                            ) : (
                                "Masuk"
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-400 text-sm mt-6">
                    Tahun Ajaran {tahunAjaran}
                </p>
            </div>
        </div>
    )
}
