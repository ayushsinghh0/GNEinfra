import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora, Geist_Mono } from "next/font/google";
import "./globals.css";

// Body / UI — warm, friendly, premium.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-pjs",
  subsets: ["latin"],
  display: "swap",
});

// Display — confident headings (hero / step / success titles only).
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

// Monospace — identifiers (vendor codes, GST/PAN, IFSC).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GNE Vendor Portal",
  description: "GNE ERP — Vendor Registration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${sora.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
