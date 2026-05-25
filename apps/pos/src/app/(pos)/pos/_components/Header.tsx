'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { usePosSession } from '@/context/pos-session-context'
import { useBusinessSettings } from '@/context/business-settings-context'

export function Header() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const { activeBusiness, businesses, switchBusiness } = usePosSession()
  const { businessType, hasTableManagement } = useBusinessSettings()
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const multipleBusinesses = businesses.length > 1

  const nav = [
    { href: '/pos', label: 'Terminal' },
    ...(hasTableManagement ? [{ href: '/comandeo', label: 'Mesas' }] : []),
    ...(businessType === 'restaurant' ? [{ href: '/kds', label: 'Cocina' }] : []),
    { href: '/products', label: 'Productos' },
    { href: '/history', label: 'Historial' },
    { href: '/sessions', label: 'Turnos' },
    { href: '/settings', label: 'Ajustes' },
  ]

  return (
    <header className="flex h-14 items-center border-b border-brand-navy bg-brand-dark px-6">
      {/* Logo + business */}
      <div className="flex w-52 items-center gap-2 shrink-0">
        <span className="font-mono text-sm font-semibold tracking-widest text-brand-teal">
          SENKU
        </span>
        <span className="text-brand-surface/20">|</span>

        {multipleBusinesses ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1 truncate text-xs text-brand-surface/60 transition hover:text-brand-surface"
            >
              <span className="max-w-28 truncate">{activeBusiness?.name ?? 'Seleccionar'}</span>
              <span className="text-[10px]">▾</span>
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-7 z-50 min-w-40 rounded-xl border border-brand-navy bg-brand-dark shadow-xl">
                {businesses.map((b) => (
                  <button
                    key={b.id}
                    onClick={async () => {
                      await switchBusiness(b.id)
                      setDropdownOpen(false)
                    }}
                    className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs transition first:rounded-t-xl last:rounded-b-xl hover:bg-brand-navy ${
                      b.id === activeBusiness?.id
                        ? 'font-semibold text-brand-teal'
                        : 'text-brand-surface/70'
                    }`}
                  >
                    {b.id === activeBusiness?.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
                    )}
                    {b.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <span className="max-w-32 truncate text-xs text-brand-surface/60">
            {activeBusiness?.name ?? 'POS'}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 items-center justify-center gap-1">
        {nav.map(({ href, label }) => {
          const active = href === '/pos' ? pathname === '/pos' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                active
                  ? 'bg-brand-navy text-brand-surface'
                  : 'text-brand-surface/50 hover:text-brand-surface'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="flex w-52 items-center justify-end gap-3">
        <span className="truncate text-xs text-brand-surface/40">
          {user?.firstName ?? user?.emailAddresses[0]?.emailAddress}
        </span>
        <button
          onClick={() => signOut({ redirectUrl: 'https://gosenku.com/hub' })}
          className="shrink-0 rounded px-3 py-1 text-xs text-brand-surface/30 transition hover:bg-brand-navy hover:text-brand-surface"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
