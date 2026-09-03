import { NextResponse } from "next/server";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: "File tidak ditemukan." }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "Ukuran file terlalu besar (maksimal 2MB)." }, { status: 400 });
        }

        if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
            return NextResponse.json({ error: "Tipe file tidak didukung. Hanya gambar (JPG, PNG, WEBP) yang diizinkan." }, { status: 400 });
        }

        // Sanitize extension
        const originalName = file.name.toLowerCase();
        const ext = path.extname(originalName);
        if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
            return NextResponse.json({ error: "Ekstensi file tidak valid." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const safeBaseName = path.basename(originalName, ext).replace(/[^a-z0-9_-]/gi, "_");
        const filename = `${Date.now()}_${safeBaseName}${ext}`;

        const uploadDir = path.join(process.cwd(), "public/uploads");
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, filename), buffer);

        return NextResponse.json({
            message: "Success",
            url: `/uploads/${filename}`
        });
    } catch (error) {
        console.error("Error occurred in upload:", error);
        return NextResponse.json({ error: "Gagal mengunggah berkas." }, { status: 500 });
    }
}
