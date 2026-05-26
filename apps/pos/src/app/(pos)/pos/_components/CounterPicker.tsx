'use client'

const DEFAULT_COUNTERS = ['Caja 1', 'Caja 2', 'Caja 3', 'Caja 4', 'Ventanilla', 'Mostrador']

interface Props {
  onSelect: (counter: string) => void
}

export function CounterPicker({ onSelect }: Props) {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-xl font-bold text-brand-surface">¿Cuál es tu caja?</h2>
        <p className="mt-1 text-sm text-brand-surface/40">
          Las órdenes aparecerán bajo este nombre en cocina
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        {DEFAULT_COUNTERS.map((counter) => (
          <button
            key={counter}
            onClick={() => onSelect(counter)}
            className="rounded-xl bg-brand-navy px-4 py-5 text-sm font-semibold text-brand-surface transition hover:bg-brand-navy/80 hover:text-brand-teal active:scale-95"
          >
            {counter}
          </button>
        ))}
      </div>
    </div>
  )
}
