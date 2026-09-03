import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = 'force-dynamic';

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

        const mimeType = file.type?.toLowerCase() || "image/jpeg";
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
            return NextResponse.json({ error: "Tipe file tidak didukung. Hanya gambar (JPG, PNG, WEBP) yang diizinkan." }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Data}`;

        return NextResponse.json({
            message: "Success",
            url: dataUrl
        });
    } catch (error) {
        console.error("Error occurred in upload:", error);
        return NextResponse.json({ error: "Gagal mengunggah berkas." }, { status: 500 });
    }
}
