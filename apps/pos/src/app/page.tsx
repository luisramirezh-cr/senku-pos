import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LandingPage() {
  const { userId } = await auth()
  if (userId) redirect('/pos')

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-brand-dark">

      {/* ── Background layers ─────────────────────────────────── */}
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-[0.032]" />
      <div className="pointer-events-none absolute -right-40 -top-40 h-[700px] w-[700px] rounded-full bg-brand-teal/[0.07] blur-[160px]" />
      <div className="pointer-events-none absolute -bottom-60 -left-40 h-[600px] w-[600px] rounded-full bg-brand-blue/[0.07] blur-[140px]" />
      {/* thin diagonal accent line */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(135deg, #06B6D4 0px, #06B6D4 1px, transparent 1px, transparent 60px)',
        }}
      />

      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="anim-1 relative z-10 flex items-center justify-between px-8 py-7 sm:px-14">
        <div className="flex items-center gap-2.5">
          <div className="glow-pulse h-1.5 w-1.5 rounded-full bg-brand-teal" />
          <span className="font-mono text-[11px] tracking-[0.22em] text-brand-teal/75 uppercase">
            Senku
          </span>
        </div>
        <Link
          href="/sign-in"
          className="rounded-lg border border-brand-surface/[0.08] px-4 py-1.5 font-mono text-[11px] tracking-widest text-brand-surface/40 uppercase transition hover:border-brand-teal/30 hover:text-brand-surface/80"
        >
          Ingresar
        </Link>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-8 pb-16 sm:px-14 lg:px-20">
        <div className="max-w-3xl">

          <p className="anim-2 mb-7 font-mono text-[10px] tracking-[0.3em] text-brand-teal/50 uppercase">
            Sistema de punto de venta
          </p>

          <h1 className="anim-3 mb-7 font-sans text-[clamp(3rem,9vw,6.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-brand-surface">
            Para negocios<br />
            <span className="text-brand-teal">que no</span><br />
            esperan.
          </h1>

          <p className="anim-4 mb-12 max-w-sm text-[15px] leading-relaxed text-brand-surface/35">
            Comandeo, cocina, ventas y clientes —<br />
            todo desde una sola pantalla.
          </p>

          <div className="anim-5 flex items-center gap-4">
            <Link
              href="/sign-in"
              className="group inline-flex items-center gap-3 rounded-xl bg-brand-teal px-8 py-4 text-[13px] font-bold tracking-wide text-brand-dark transition hover:bg-brand-teal/90 active:scale-[0.98]"
            >
              Iniciar sesión
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="anim-1 relative z-10 flex items-center justify-between border-t border-brand-surface/[0.05] px-8 py-5 sm:px-14">
        <span className="font-mono text-[9px] tracking-[0.25em] text-brand-surface/20 uppercase">
          pos.gosenku.com
        </span>
        <span className="font-mono text-[9px] tracking-[0.25em] text-brand-surface/20 uppercase">
          © 2025 Senku
        </span>
      </footer>

    </div>
  )
}
