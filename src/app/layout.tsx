import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "BarberAdmin — Управление барбершопом",
  description: "Панель управления барбершопом",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="h-full bg-[#111827] text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
