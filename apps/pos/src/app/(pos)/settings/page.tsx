'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { usePosSession } from '@/context/pos-session-context'
import { useBusinessSettings } from '@/context/business-settings-context'
import { COUNTRY_TAX } from '@/lib/tax'

const inputCls = 'w-full rounded-lg bg-brand-dark px-3 py-2 text-sm text-brand-surface placeholder:text-brand-surface/20 focus:outline-none focus:ring-1 focus:ring-brand-teal'

export default function SettingsPage() {
  const { activeBusiness } = usePosSession()
  const settings = useBusinessSettings()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [country, setCountry] = useState(settings.country)
  const [fiscalEnabled, setFiscalEnabled] = useState(settings.fiscalEnabled)
  const [fiscalRnc, setFiscalRnc] = useState(settings.fiscalRnc ?? '')
  const [apiUser, setApiUser] = useState('')
  const [apiPassword, setApiPassword] = useState('')
  const [certBase64, setCertBase64] = useState('')
  const [certFileName, setCertFileName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uberEatsStoreId, setUberEatsStoreId] = useState(settings.uberEatsStoreId ?? '')
  const [pedidosYaStoreId, setPedidosYaStoreId] = useState(settings.pedidosYaStoreId ?? '')
  const [shopifyShopDomain, setShopifyShopDomain] = useState(settings.shopifyShopDomain ?? '')
  const [shopifyWebhookSecret, setShopifyWebhookSecret] = useState('')

  function handleCertFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCertFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as ArrayBuffer
      const bytes = new Uint8Array(result)
      let binary = ''
      bytes.forEach((b) => { binary += String.fromCharCode(b) })
      setCertBase64(btoa(binary))
    }
    reader.readAsArrayBuffer(file)
  }

  async function save() {
    if (!activeBusiness?.id) return
    setSaving(true)
    const tax = COUNTRY_TAX[country] ?? COUNTRY_TAX['CR']
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessId:           activeBusiness.id,
        businessType:         settings.businessType,
        hasTableManagement:   settings.hasTableManagement,
        country,
        taxRate:              tax.rate,
        taxName:              tax.name,
        fiscalEnabled,
        fiscalRnc:            fiscalRnc || null,
        onboardingDone:       settings.onboardingDone,
        fiscalCertBase64:     certBase64 || null,
        fiscalApiUser:        apiUser || null,
        fiscalApiPassword:    apiPassword || null,
        uberEatsStoreId:      uberEatsStoreId || null,
        pedidosYaStoreId:     pedidosYaStoreId || null,
        shopifyShopDomain:    shopifyShopDomain || null,
        shopifyWebhookSecret: shopifyWebhookSecret || null,
      }),
    })
    await settings.refresh()
    setSaving(false)
    setSaved(true)
    setApiUser('')
    setApiPassword('')
    setCertBase64('')
    setCertFileName('')
    setShopifyWebhookSecret('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    setTimeout(() => setSaved(false), 2000)
  }

  const showFiscalCreds = fiscalEnabled && country === 'CR'

  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="mb-6 text-xl font-bold text-brand-surface">Ajustes del negocio</h1>

      <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand-surface/40">Negocio</p>
        <p className="text-sm text-brand-surface">{activeBusiness?.name}</p>
        <p className="mt-1 text-xs text-brand-surface/40">
          {settings.businessType === 'restaurant' ? 'Restaurante' : 'Retail'} ·{' '}
          {settings.hasTableManagement ? 'Servicio en mesa' : 'Mostrador / To-go'}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-surface/40">País e impuesto</p>
        <div className="grid grid-cols-2 gap-2">
          {(['CR', 'DO'] as const).map((c) => {
            const tax = COUNTRY_TAX[c]
            return (
              <button
                key={c}
                onClick={() => setCountry(c)}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  country === c
                    ? 'border-brand-teal bg-brand-teal/10'
                    : 'border-transparent bg-brand-dark hover:border-brand-navy'
                }`}
              >
                <p className="text-sm font-semibold text-brand-surface">
                  {c === 'CR' ? '🇨🇷 Costa Rica' : '🇩🇴 Rep. Dom.'}
                </p>
                <p className="text-xs text-brand-surface/40">
                  {tax.name} {tax.rate}%
                </p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-surface">Factura Electrónica</p>
            <p className="text-xs text-brand-surface/40">
              {country === 'CR' ? 'Hacienda / TRIBU-CR' : 'DGII e-CF'}
            </p>
          </div>
          <button
            onClick={() => setFiscalEnabled((v) => !v)}
            className={`relative h-6 w-10 rounded-full transition-colors ${fiscalEnabled ? 'bg-brand-teal' : 'bg-brand-surface/20'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${fiscalEnabled ? 'translate-x-4' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        {fiscalEnabled && (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-brand-surface/50">
                {country === 'CR' ? 'Cédula jurídica / física' : 'RNC'}
              </label>
              <input
                value={fiscalRnc}
                onChange={(e) => setFiscalRnc(e.target.value)}
                placeholder={country === 'CR' ? '3-101-XXXXXX' : '1-XX-XXXXX'}
                className={inputCls}
              />
            </div>

            {showFiscalCreds && (
              <>
                {settings.fiscalCredentialsConfigured && !certBase64 && !apiUser && !apiPassword && (
                  <div className="flex items-center gap-2 rounded-lg bg-brand-teal/10 px-3 py-2">
                    <span className="text-brand-teal">✓</span>
                    <span className="text-xs text-brand-teal">Credenciales configuradas</span>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">
                    Certificado .p12 de Hacienda
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-lg border border-brand-navy bg-brand-dark px-3 py-2 text-xs text-brand-surface/70 transition hover:border-brand-teal hover:text-brand-surface"
                    >
                      {certFileName || 'Seleccionar archivo'}
                    </button>
                    {certFileName && (
                      <span className="truncate max-w-[140px] text-xs text-brand-teal">{certFileName}</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".p12"
                    onChange={handleCertFile}
                    className="hidden"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">Usuario API Hacienda</label>
                  <input
                    type="text"
                    value={apiUser}
                    onChange={(e) => setApiUser(e.target.value)}
                    placeholder={settings.fiscalCredentialsConfigured ? '(sin cambios)' : 'usuario@empresa.com'}
                    autoComplete="off"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-brand-surface/50">
                    Contraseña (certificado y API)
                  </label>
                  <input
                    type="password"
                    value={apiPassword}
                    onChange={(e) => setApiPassword(e.target.value)}
                    placeholder={settings.fiscalCredentialsConfigured ? '(sin cambios)' : '••••••••'}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {settings.businessType === 'restaurant' && (
        <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-surface/40">
            Delivery
          </p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-brand-surface/50">Uber Eats Store ID</label>
              <input
                value={uberEatsStoreId}
                onChange={(e) => setUberEatsStoreId(e.target.value)}
                placeholder="store-uuid-del-dashboard"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-surface/50">Pedidos Ya Restaurant ID</label>
              <input
                value={pedidosYaStoreId}
                onChange={(e) => setPedidosYaStoreId(e.target.value)}
                placeholder="py-restaurant-id"
                className={inputCls}
              />
            </div>
            <p className="text-xs text-brand-surface/30">
              Webhook URL: <span className="font-mono">/api/webhooks/uber-eats</span> ·{' '}
              <span className="font-mono">/api/webhooks/pedidos-ya</span>
            </p>
          </div>
        </div>
      )}

      {settings.businessType === 'retail' && (
        <div className="mb-6 rounded-2xl border border-brand-navy bg-brand-navy/30 p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-brand-surface/40">
            Shopify
          </p>
          <div className="space-y-3">
            {settings.shopifyConfigured && !shopifyShopDomain && !shopifyWebhookSecret && (
              <div className="flex items-center gap-2 rounded-lg bg-brand-teal/10 px-3 py-2">
                <span className="text-brand-teal">✓</span>
                <span className="text-xs text-brand-teal">Shopify conectado</span>
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-brand-surface/50">Shop domain</label>
              <input
                value={shopifyShopDomain}
                onChange={(e) => setShopifyShopDomain(e.target.value)}
                placeholder="tu-tienda.myshopify.com"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-brand-surface/50">Webhook secret</label>
              <input
                type="password"
                value={shopifyWebhookSecret}
                onChange={(e) => setShopifyWebhookSecret(e.target.value)}
                placeholder={settings.shopifyConfigured ? '(sin cambios)' : 'shpss_...'}
                autoComplete="new-password"
                className={inputCls}
              />
            </div>
            <p className="text-xs text-brand-surface/30">
              Webhook URL: <span className="font-mono">/api/webhooks/shopify</span>
              {' · '}Tema: <span className="font-mono">orders/create</span>
            </p>
          </div>
        </div>
      )}

      {settings.businessType === 'restaurant' && settings.hasTableManagement && (
        <Link
          href="/tables"
          className="mb-4 flex w-full items-center justify-between rounded-xl bg-brand-navy px-5 py-3 text-sm text-brand-surface transition hover:bg-brand-navy/80"
        >
          <span>Gestión de mesas</span>
          <span className="text-brand-surface/30">→</span>
        </Link>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-xl bg-brand-teal py-3 text-sm font-bold text-brand-dark transition hover:bg-brand-teal/90 disabled:opacity-40"
      >
        {saved ? '✓ Guardado' : saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
    </div>
  )
}
