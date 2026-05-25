import { PosSessionProvider } from '@/context/pos-session-context'
import { BusinessSettingsProvider } from '@/context/business-settings-context'
import { Header } from './pos/_components/Header'

export default function PosLayout({ children }: { children: React.ReactNode }) {
  return (
    <PosSessionProvider>
      <BusinessSettingsProvider>
        <div className="flex min-h-screen flex-col bg-brand-dark">
          <Header />
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
      </BusinessSettingsProvider>
    </PosSessionProvider>
  )
}
