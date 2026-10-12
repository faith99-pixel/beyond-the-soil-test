import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Beyond the Soil Test | Socio-Ecological Soil Health Dashboard",
  description:
    "An interactive research dashboard integrating biophysical soil-health indicators with social and behavioral drivers to support sustainable land management and agricultural resilience. Demonstration prototype for doctoral research.",
  keywords: [
    "soil health",
    "socio-ecological",
    "farmer decision-making",
    "agricultural resilience",
    "soil organic carbon",
    "extension services",
    "research dashboard",
  ],
  authors: [{ name: "Murdoch University HDR Research" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
