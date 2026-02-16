import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials, req) {
                if (!credentials?.username || !credentials?.password) {
                    return null
                }

                const user = await prisma.user.findUnique({
                    where: { username: credentials.username }
                })

                if (!user) {
                    return null
                }

                const isValid = await bcrypt.compare(credentials.password, user.password)

                if (!isValid) {
                    return null
                }

                // Capture IP address
                let ip = "unknown"
                if (req?.headers) {
                    // Handle different header formats (Entries or generic object)
                    const headers = req.headers as any
                    // Try standard headers
                    ip = headers.get?.("x-forwarded-for") ||
                        headers["x-forwarded-for"] ||
                        headers.get?.("x-real-ip") ||
                        headers["x-real-ip"] ||
                        "unknown"

                    // Handle comma separated IPs (take first)
                    if (ip.includes(",")) {
                        ip = ip.split(",")[0].trim()
                    }
                }

                return {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    role: user.role,
                    kelas: user.kelas,
                    fotoProfilUrl: user.fotoProfilUrl,
                    mapelDiampu: user.mapelDiampu,
                    loginIp: ip
                } as any
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
                token.username = user.username
                token.role = user.role
                token.kelas = user.kelas
                token.fotoProfilUrl = user.fotoProfilUrl
                token.mapelDiampu = user.mapelDiampu
            }
            return token
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string
                session.user.username = token.username as string
                session.user.role = token.role as string
                session.user.kelas = token.kelas as number | null
                session.user.fotoProfilUrl = token.fotoProfilUrl as string | null
                session.user.mapelDiampu = token.mapelDiampu as string | null
            }
            return session
        }
    },
    pages: {
        signIn: "/login"
    },
    session: {
        strategy: "jwt"
    },
    events: {
        async signIn({ user }) {
            try {
                // Retrieve IP passed from authorize
                const userWithIp = user as any
                const ip = userWithIp.loginIp || "unknown"

                await prisma.activityLog.create({
                    data: {
                        userId: user.id,
                        action: "LOGIN",
                        details: `Login sebagai ${user.role}`,
                        ipAddress: ip
                    }
                })
            } catch (error) {
                console.error("Failed to log sign in:", error)
            }
        },
        async signOut({ token }) {
            try {
                if (token && token.sub) {
                    await prisma.activityLog.create({
                        data: {
                            userId: token.sub, // 'sub' is the user ID in JWT
                            action: "LOGOUT",
                            details: "Logout dari sistem",
                        }
                    })
                }
            } catch (error) {
                console.error("Failed to log sign out:", error)
            }
        }
    },
    secret: process.env.NEXTAUTH_SECRET
}
