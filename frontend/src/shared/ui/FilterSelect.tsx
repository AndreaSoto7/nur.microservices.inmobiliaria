interface FilterSelectProps<T extends string> {
  label: string
  value: T | undefined
  options: readonly T[]
  labels: Record<T, string>
  onChange: (value: T | undefined) => void
}

/** Filtro que aplica al momento. Sin elegir nada muestra "Todos". */
export function FilterSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: FilterSelectProps<T>) {
  return (
    <label className="sort-select">
      {label}
      <select
        className="select"
        value={value ?? ''}
        onChange={(event) => onChange((event.target.value || undefined) as T | undefined)}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
    </label>
  )
}
