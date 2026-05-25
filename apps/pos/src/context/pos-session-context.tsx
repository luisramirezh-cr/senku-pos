'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { SessionBusiness, SessionData } from '@/lib/root-api'

interface PosSession extends SessionData {
  loading: boolean
  switchBusiness: (businessId: string) => Promise<void>
}

const PosSessionContext = createContext<PosSession>({
  userId: '',
  businesses: [],
  activeBusiness: null,
  loading: true,
  switchBusiness: async () => {},
})

export function PosSessionProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SessionData>({
    userId: '',
    businesses: [],
    activeBusiness: null,
  })
  const [loading, setLoading] = useState(true)

  async function fetchSession() {
    const res = await fetch('/api/session')
    const json = await res.json() as SessionData
    setData(json)
    setLoading(false)
  }

  useEffect(() => {
    fetchSession().catch(() => setLoading(false))
  }, [])

  const switchBusiness = useCallback(async (businessId: string) => {
    const res = await fetch('/api/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId }),
    })
    const json = await res.json() as SessionData
    setData(json)
  }, [])

  return (
    <PosSessionContext.Provider value={{ ...data, loading, switchBusiness }}>
      {children}
    </PosSessionContext.Provider>
  )
}

export const usePosSession = () => useContext(PosSessionContext)
export type { SessionBusiness }
