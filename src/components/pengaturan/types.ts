export interface SchoolSettings {
    namaSekolah: string
    kepalaSekolah: string
    nipKepsek: string
    tahunAjaran: string
    semesterAktif: number
}

export interface MyAccount {
    name: string
    username: string
    currentPassword: string
    newPassword: string
    confirmPassword: string
    fotoProfilUrl?: string
    role?: string
    nip?: string | null
    kelas?: number | null
    mapelDiampu?: string | null
}

export interface DbInfo {
    counts: {
        siswa: number
        absensi: number
        nilai: number
        jurnal: number
        buku: number
        aset: number
        user: number
    }
}

export interface KenaikanPreview {
    perKelas: Record<number, number>
    tahunAjaranSekarang: string
    tahunAjaranBaru: string
}
