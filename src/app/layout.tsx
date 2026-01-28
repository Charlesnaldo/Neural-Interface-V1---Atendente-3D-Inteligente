import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: 'swap', 
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: 'swap',
});


export const metadata: Metadata = {
  title: "Zord AI | Atendente Virtual Inteligente",
  description: "Interface de atendimento neural avançada equipada com Gemini 2.5 Flash.",
  keywords: ["IA", "Atendente Virtual", "Next.js", "Gemini API", "Cicero AI"],
  authors: [{ name: "Ronaldo Charles" }],
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, 
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950 text-white selection:bg-blue-500/30`}
      >
        {children}
      </body>
    </html>
  );
}