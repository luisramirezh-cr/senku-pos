'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { usePosSession } from './pos-session-context'

export interface BusinessSettingsData {
  businessId: string
  businessType: 'restaurant' | 'retail'
  hasTableManagement: boolean
  country: 'CR' | 'DO'
  taxRate: number
  taxName: string
  fiscalEnabled: boolean
  fiscalRnc: string | null
  onboardingDone: boolean
  fiscalCredentialsConfigured: boolean
  uberEatsStoreId: string | null
  pedidosYaStoreId: string | null
  shopifyShopDomain: string | null
  shopifyConfigured: boolean
}

interface ContextValue extends BusinessSettingsData {
  loading: boolean
  refresh: () => Promise<void>
}

const defaults: BusinessSettingsData = {
  businessId: '',
  businessType: 'restaurant',
  hasTableManagement: false,
  country: 'CR',
  taxRate: 13,
  taxName: 'IVA',
  fiscalEnabled: false,
  fiscalRnc: null,
  onboardingDone: false,
  fiscalCredentialsConfigured: false,
  uberEatsStoreId: null,
  pedidosYaStoreId: null,
  shopifyShopDomain: null,
  shopifyConfigured: false,
}

const BusinessSettingsContext = createContext<ContextValue>({
  ...defaults,
  loading: true,
  refresh: async () => {},
})

export function BusinessSettingsProvider({ children }: { children: ReactNode }) {
  const { activeBusiness } = usePosSession()
  const [settings, setSettings] = useState<BusinessSettingsData>(defaults)
  const [loading, setLoading] = useState(true)

  async function load() {
    if (!activeBusiness?.id) return
    setLoading(true)
    try {
      const res = await fetch(`/api/settings?businessId=${activeBusiness.id}`)
      if (res.ok) setSettings(await res.json() as BusinessSettingsData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [activeBusiness?.id])

  return (
    <BusinessSettingsContext.Provider value={{ ...settings, loading, refresh: load }}>
      {children}
    </BusinessSettingsContext.Provider>
  )
}

export const useBusinessSettings = () => useContext(BusinessSettingsContext)
