interface Props {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  big?: boolean
}

export function QtyStepper({ value, onChange, min = 1, max = 999, big }: Props) {
  return (
    <div className={`qty ${big ? 'qty-big' : ''}`} role="group" aria-label="かず">
      <button type="button" className="qty-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label="へらす">
        −
      </button>
      <input
        className="qty-input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10)
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
        }}
      />
      <button type="button" className="qty-btn" onClick={() => onChange(Math.min(max, value + 1))} aria-label="ふやす">
        ＋
      </button>
    </div>
  )
}
