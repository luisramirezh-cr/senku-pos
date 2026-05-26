import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { getClerkSatelliteConfig } from "@/lib/clerk-config";
import "./globals.css";

export const metadata: Metadata = {
  title: "Senku POS",
  description: "Sistema de punto de venta — Senku",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider {...getClerkSatelliteConfig()}>
      <html lang="es">
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
