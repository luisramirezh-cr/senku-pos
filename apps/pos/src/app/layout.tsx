import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Senku POS',
  description: 'Sistema de punto de venta — Senku',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={process.env.NEXT_PUBLIC_APP_URL}
      signUpFallbackRedirectUrl="https://gosenku.com/hub"
    >
      <html lang="es">
        <body className="font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
