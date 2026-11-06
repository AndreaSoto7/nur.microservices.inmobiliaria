interface IconProps {
  className?: string
}

/** Decorativo: el texto de al lado ya dice lo que significa. */
export function HouseIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-6h4v6" />
    </svg>
  )
}

/** Decorativo. Relleno cuando la propiedad ya está guardada. */
export function HeartIcon({ className, filled }: IconProps & { filled: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7.5-4.6-9-9.2C2 7.4 4.2 5 7 5c2 0 3.8 1.1 5 3 1.2-1.9 3-3 5-3 2.8 0 5 2.4 4 5.8-1.5 4.6-9 9.2-9 9.2Z" />
    </svg>
  )
}
