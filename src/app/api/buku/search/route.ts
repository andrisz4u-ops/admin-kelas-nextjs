import { NextResponse } from "next/server"

export const dynamic = 'force-dynamic'

// Search books using Google Books API (no API key required for basic searches)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get("q")
        const isbn = searchParams.get("isbn")

        if (!query && !isbn) {
            return NextResponse.json({ error: "Query or ISBN required" }, { status: 400 })
        }

        // Build search query
        let searchQuery = ""
        if (isbn) {
            searchQuery = `isbn:${isbn}`
        } else if (query) {
            searchQuery = query
        }

        const googleBooksUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=40&langRestrict=id`

        const response = await fetch(googleBooksUrl)
        if (!response.ok) {
            throw new Error("Failed to fetch from Google Books API")
        }

        const data = await response.json()

        // Transform the response to our format
        const books = (data.items || []).map((item: {
            id: string
            volumeInfo: {
                title?: string
                authors?: string[]
                publisher?: string
                publishedDate?: string
                industryIdentifiers?: { type: string; identifier: string }[]
                categories?: string[]
                imageLinks?: { thumbnail?: string }
            }
        }) => {
            const info = item.volumeInfo
            const isbn13 = info.industryIdentifiers?.find((id: { type: string }) => id.type === "ISBN_13")?.identifier
            const isbn10 = info.industryIdentifiers?.find((id: { type: string }) => id.type === "ISBN_10")?.identifier

            return {
                id: item.id,
                judul: info.title || "",
                penulis: info.authors?.join(", ") || "",
                penerbit: info.publisher || "",
                tahunTerbit: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4)) : null,
                isbn: isbn13 || isbn10 || "",
                kategori: info.categories?.[0] || "Pelajaran",
                thumbnail: info.imageLinks?.thumbnail || null
            }
        })

        return NextResponse.json(books)
    } catch (error) {
        console.error("Error searching books:", error)
        return NextResponse.json({ error: "Failed to search books" }, { status: 500 })
    }
}
