import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/AuthProvider";

export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Administrasi Wali Kelas - SDN 2 Nangerang",
  description: "Sistem Administrasi Wali Kelas SDN 2 Nangerang",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className} suppressHydrationWarning={true}>
        <AuthProvider>
          {children}
          <Toaster position="bottom-right" />
        </AuthProvider>
      </body>
    </html>
  );
}
