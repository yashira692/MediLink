function Icono({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function IconoCalendario() {
  return (
    <Icono>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18M12 14v4M10 16h4" />
    </Icono>
  )
}

export function IconoChat() {
  return (
    <Icono>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.2-4.6A8 8 0 1 1 21 12z" />
      <path d="M9 11h.01M12.5 11h.01M16 11h.01" />
    </Icono>
  )
}

export function IconoDocumento() {
  return (
    <Icono>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </Icono>
  )
}

export function IconoCampana() {
  return (
    <Icono>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M10.3 20a2 2 0 0 0 3.4 0" />
    </Icono>
  )
}
