"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

export const dynamic = 'force-dynamic'

export default function LoginPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const result = await signIn("credentials", {
                username,
                password,
                redirect: false,
            })

            if (result?.error) {
                toast.error("Username atau password salah!")
            } else {
                toast.success("Berhasil login!")
                router.push("/dashboard")
                router.refresh()
            }
        } catch {
            toast.error("Terjadi kesalahan!")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-blue-100">
            <div className="w-full max-w-md">
                {/* Logo & Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
                        <img src="/logo-sekolah.png" alt="Logo SDN 2 Nangerang" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        SDN 2 Nangerang
                    </h1>
                    <p className="text-gray-500 mt-1">Administrasi Wali Kelas</p>
                </div>

                {/* Login Card */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-xl shadow-gray-200/50 p-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">Masuk ke Akun</h2>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Masukkan username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                placeholder="Masukkan password"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
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
                    Tahun Ajaran 2025/2026
                </p>
            </div>
        </div>
    )
}
