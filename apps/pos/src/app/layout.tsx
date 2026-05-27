import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Senku POS',
  description: 'Sistema de punto de venta — Senku',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" signInFallbackRedirectUrl="/pos">
      <html lang="es">
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
