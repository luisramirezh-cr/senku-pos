interface Props {
  onSelect: (channel: 'DINE_IN' | 'TAKEOUT' | 'DELIVERY') => void
  onClose: () => void
}

export function ChannelPicker({ onSelect, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-dark/80 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-brand-navy p-6 pb-8">
        <h2 className="mb-5 text-center text-base font-semibold text-brand-surface">Nueva orden</h2>
        <div className="grid gap-3">
          <button
            onClick={() => onSelect('DINE_IN')}
            className="flex items-center gap-4 rounded-xl bg-brand-dark/40 p-4 text-left transition hover:bg-brand-dark/60"
          >
            <span className="text-2xl">🍽</span>
            <div>
              <p className="font-semibold text-brand-surface">Mesa</p>
              <p className="text-xs text-brand-surface/40">Selecciona una mesa del plano</p>
            </div>
          </button>
          <button
            onClick={() => onSelect('TAKEOUT')}
            className="flex items-center gap-4 rounded-xl bg-brand-dark/40 p-4 text-left transition hover:bg-brand-dark/60"
          >
            <span className="text-2xl">🥡</span>
            <div>
              <p className="font-semibold text-brand-surface">Para llevar</p>
              <p className="text-xs text-brand-surface/40">Orden sin mesa asignada</p>
            </div>
          </button>
          <button
            onClick={() => onSelect('DELIVERY')}
            className="flex items-center gap-4 rounded-xl bg-brand-dark/40 p-4 text-left transition hover:bg-brand-dark/60"
          >
            <span className="text-2xl">🛵</span>
            <div>
              <p className="font-semibold text-brand-surface">Delivery</p>
              <p className="text-xs text-brand-surface/40">Orden para entrega a domicilio</p>
            </div>
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 text-sm text-brand-surface/40 hover:text-brand-surface"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}
