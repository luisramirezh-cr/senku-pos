'use client'

import { SignIn } from '@clerk/nextjs'
import Link from 'next/link'

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-dark px-4 py-12">

      {/* ── Background layers ───────────────────────────────── */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.032]" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-brand-teal/[0.08] blur-[150px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-brand-blue/[0.07] blur-[130px]" />

      {/* ── Brand header ────────────────────────────────────── */}
      <div className="anim-1 relative z-10 mb-8 flex flex-col items-center gap-2">
        <Link href="/" className="flex items-center gap-2.5 transition hover:opacity-70">
          <div className="glow-pulse h-1.5 w-1.5 rounded-full bg-brand-teal" />
          <span className="font-mono text-[11px] tracking-[0.25em] text-brand-teal/80 uppercase">
            Senku POS
          </span>
        </Link>
        <p className="text-[13px] text-brand-surface/30">Bienvenido de vuelta</p>
      </div>

      {/* ── Clerk SignIn ─────────────────────────────────────── */}
      <div className="anim-2 relative z-10 w-full max-w-[400px]">
        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#0D9488',
              colorBackground: '#1A3355',
              colorInputBackground: '#0F1F35',
              colorText: '#F8FAFC',
              colorTextSecondary: 'rgba(248,250,252,0.4)',
              colorNeutral: '#F8FAFC',
              colorDanger: '#f87171',
              colorSuccess: '#0D9488',
              borderRadius: '12px',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontSize: '14px',
              spacingUnit: '16px',
            },
            elements: {
              card: {
                background: '#1A3355',
                boxShadow: '0 0 0 1px rgba(13,148,136,0.12), 0 32px 80px rgba(13,148,136,0.06)',
              },
              headerTitle: {
                color: '#F8FAFC',
                fontWeight: '700',
                fontSize: '18px',
              },
              headerSubtitle: {
                color: 'rgba(248,250,252,0.35)',
              },
              socialButtonsBlockButton: {
                background: 'rgba(255,255,255,0.02)',
                borderColor: 'rgba(248,250,252,0.08)',
                color: '#F8FAFC',
              },
              socialButtonsBlockButtonText: {
                color: '#F8FAFC',
                fontWeight: '500',
              },
              dividerLine: { background: 'rgba(248,250,252,0.07)' },
              dividerText: { color: 'rgba(248,250,252,0.22)' },
              formFieldLabel: { color: 'rgba(248,250,252,0.55)' },
              formFieldInput: {
                background: '#0F1F35',
                borderColor: 'rgba(248,250,252,0.1)',
                color: '#F8FAFC',
              },
              formButtonPrimary: {
                background: '#0D9488',
                color: '#0F1F35',
                fontWeight: '700',
              },
              footerActionText: { color: 'rgba(248,250,252,0.3)' },
              footerActionLink: { color: '#0D9488' },
              footer: { background: '#1A3355' },
              identityPreviewText: { color: '#F8FAFC' },
              identityPreviewEditButton: { color: '#0D9488' },
            },
          }}
        />
      </div>

    </div>
  )
}
