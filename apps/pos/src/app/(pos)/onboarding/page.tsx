'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePosSession } from '@/context/pos-session-context'
import { useBusinessSettings } from '@/context/business-settings-context'
import { taxRateForCountry } from '@/lib/tax'

export default function OnboardingPage() {
  const router = useRouter()
  const { activeBusiness } = usePosSession()
  const { refresh } = useBusinessSettings()
  const [step, setStep] = useState<1 | 2>(1)
  const [bizType, setBizType] = useState<'restaurant' | 'retail' | null>(null)
  const [country, setCountry] = useState<'CR' | 'DO'>('CR')
  const [saving, setSaving] = useState(false)

  async function finish(type: 'restaurant' | 'retail', hasTables: boolean) {
    if (!activeBusiness?.id) return
    setSaving(true)
    const tax = taxRateForCountry(country)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId: activeBusiness.id,
        businessType: type,
        hasTableManagement: hasTables,
        country,
        taxRate: tax.rate,
        taxName: tax.name,
        fiscalEnabled: false,
        onboardingDone: true,
      }),
    })
    await refresh()
    router.replace('/pos')
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Progress bar */}
        <div className="mb-8 flex gap-2">
          {[1, 2].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${n <= step ? 'bg-brand-teal' : 'bg-brand-surface/10'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 className="mb-2 text-xl font-bold text-brand-surface">Bienvenido a Senku POS</h1>
            <p className="mb-8 text-sm text-brand-surface/50">
              Cuéntanos sobre tu negocio para configurar el sistema.
            </p>

            <p className="mb-3 text-sm font-semibold text-brand-surface">¿Qué tipo de negocio tienes?</p>
            <div className="mb-6 grid gap-3">
              <button
                onClick={() => { setBizType('restaurant'); setStep(2) }}
                className="flex items-center gap-4 rounded-xl border-2 border-transparent bg-brand-navy p-4 text-left transition hover:border-brand-teal"
              >
                <span className="text-3xl">🍽</span>
                <div>
                  <p className="font-semibold text-brand-surface">Restaurante / Food Service</p>
                  <p className="text-xs text-brand-surface/40">Comidas y bebidas, menú</p>
                </div>
              </button>
              <button
                onClick={() => { setBizType('retail'); setStep(2) }}
                className="flex items-center gap-4 rounded-xl border-2 border-transparent bg-brand-navy p-4 text-left transition hover:border-brand-teal"
              >
                <span className="text-3xl">🛍</span>
                <div>
                  <p className="font-semibold text-brand-surface">Retail / Tienda</p>
                  <p className="text-xs text-brand-surface/40">Productos con manejo de stock</p>
                </div>
              </button>
            </div>

            <p className="mb-2 text-xs text-brand-surface/40">País de operación</p>
            <div className="grid grid-cols-2 gap-2">
              {(['CR', 'DO'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCountry(c)}
                  className={`rounded-lg py-2 text-xs font-semibold transition ${
                    country === c
                      ? 'bg-brand-teal text-brand-dark'
                      : 'bg-brand-dark/40 text-brand-surface/60 hover:bg-brand-dark/60'
                  }`}
                >
                  {c === 'CR' ? '🇨🇷 Costa Rica' : '🇩🇴 Rep. Dominicana'}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && bizType === 'restaurant' && (
          <>
            <button
              onClick={() => setStep(1)}
              className="mb-6 text-xs text-brand-surface/40 hover:text-brand-surface"
            >
              ← Atrás
            </button>
            <h1 className="mb-2 text-xl font-bold text-brand-surface">Estilo de servicio</h1>
            <p className="mb-8 text-sm text-brand-surface/50">¿Cómo manejas los pedidos?</p>
            <div className="grid gap-3">
              <button
                onClick={() => void finish('restaurant', true)}
                disabled={saving}
                className="flex items-center gap-4 rounded-xl border-2 border-transparent bg-brand-navy p-4 text-left transition hover:border-brand-teal disabled:opacity-40"
              >
                <span className="text-3xl">🪑</span>
                <div>
                  <p className="font-semibold text-brand-surface">Servicio en mesa</p>
                  <p className="text-xs text-brand-surface/40">Plano de mesas, comandeo por waiter</p>
                </div>
              </button>
              <button
                onClick={() => void finish('restaurant', false)}
                disabled={saving}
                className="flex items-center gap-4 rounded-xl border-2 border-transparent bg-brand-navy p-4 text-left transition hover:border-brand-teal disabled:opacity-40"
              >
                <span className="text-3xl">🥡</span>
                <div>
                  <p className="font-semibold text-brand-surface">Mostrador / Para llevar</p>
                  <p className="text-xs text-brand-surface/40">Pedido y pago en el counter</p>
                </div>
              </button>
            </div>
          </>
        )}

        {step === 2 && bizType === 'retail' && (
          <>
            <button
              onClick={() => setStep(1)}
              className="mb-6 text-xs text-brand-surface/40 hover:text-brand-surface"
            >
              ← Atrás
            </button>
            <h1 className="mb-2 text-xl font-bold text-brand-surface">Todo listo</h1>
            <p className="mb-8 text-sm text-brand-surface/50">
              Tu POS estará configurado para retail con manejo de stock por producto.
            </p>
            <button
              onClick={() => void finish('retail', false)}
              disabled={saving}
              className="w-full rounded-xl bg-brand-teal py-3 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
            >
              {saving ? 'Configurando...' : 'Comenzar →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
