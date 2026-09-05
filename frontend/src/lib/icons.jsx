/* Ícones de linha minimalistas (stroke). Tamanho via prop `s`. */
const base = (s) => ({
  width: s, height: s, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round",
})

export const Icon = {
  logout: (s = 20) => (<svg {...base(s)}><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M10 12h10m-4-4 4 4-4 4" /></svg>),
  menu: (s = 22) => (<svg {...base(s)}><path d="M3 6h18M3 12h18M3 18h18" /></svg>),
  search: (s = 20) => (<svg {...base(s)}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>),
  eye: (s = 20) => (<svg {...base(s)}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>),
  eyeOff: (s = 20) => (<svg {...base(s)}><path d="m3 3 18 18" /><path d="M10.6 6.2A10.8 10.8 0 0 1 12 6c6 0 9.5 6 9.5 6a15 15 0 0 1-2.1 2.8M6.3 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 3.1-.5" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>),
  plus: (s = 18) => (<svg {...base(s)}><path d="M12 5v14M5 12h14" /></svg>),
  minus: (s = 18) => (<svg {...base(s)}><path d="M5 12h14" /></svg>),
  report: (s = 18) => (<svg {...base(s)}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M9 13h6M9 17h4" /></svg>),
  home: (s = 20) => (<svg {...base(s)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" /></svg>),
  grid: (s = 20) => (<svg {...base(s)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>),
  users: (s = 20) => (<svg {...base(s)}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 20a5.5 5.5 0 0 0-2-4.3" /></svg>),
  gear: (s = 20) => (<svg {...base(s)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 2.6h0A1.6 1.6 0 0 0 11 1.1V1a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v0a1.6 1.6 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" /></svg>),
  chevron: (s = 16) => (<svg {...base(s)}><path d="m6 9 6 6 6-6" /></svg>),
  chevronR: (s = 16) => (<svg {...base(s)}><path d="m9 6 6 6-6 6" /></svg>),
  close: (s = 20) => (<svg {...base(s)}><path d="M18 6 6 18M6 6l12 12" /></svg>),
  bell: (s = 18) => (<svg {...base(s)}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>),
  alert: (s = 18) => (<svg {...base(s)}><path d="M10.3 3.6 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></svg>),
  detail: (s = 16) => (<svg {...base(s)}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>),
  trash: (s = 16) => (<svg {...base(s)}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" /></svg>),
  edit: (s = 16) => (<svg {...base(s)}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>),
  send: (s = 18) => (<svg {...base(s)}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4Z" /></svg>),
  presence: (s = 22) => (<svg {...base(s)}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17.5" cy="7" r="2.4" /><path d="M16 13.5a5.5 5.5 0 0 1 5.5 6.5" /></svg>),
  // Categorias
  spray: (s = 20) => (<svg {...base(s)}><path d="M9 11h6v9a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z" /><path d="M9 11V7h6M9 9h6" /><path d="M15 5h2M15 3h3M18 5h2" /></svg>),
  food: (s = 20) => (<svg {...base(s)}><path d="M4 3v7a3 3 0 0 0 6 0V3M7 3v18" /><path d="M17 3c-1.5 0-3 1.8-3 5s1.5 4 3 4 3-.8 3-4-1.5-5-3-5Z" /><path d="M17 12v9" /></svg>),
  refresh: (s = 20) => (<svg {...base(s)}><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>),
  wrench: (s = 20) => (<svg {...base(s)}><path d="M14.5 6a3.5 3.5 0 0 0 4.5 4.5L21 12l-9 9-3-3 9-9 1.5-2.5A3.5 3.5 0 0 0 14.5 6Z" /></svg>),
  backpack: (s = 20) => (<svg {...base(s)}><path d="M6 9a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" /><path d="M9 9a3 3 0 0 1 6 0" /><path d="M9 14h6v4H9z" /></svg>),
  box: (s = 20) => (<svg {...base(s)}><path d="M21 8 12 3 3 8l9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></svg>),
  leaf: (s = 16) => (<svg {...base(s)}><path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-9 0 10-4 13-9 13Z" /><path d="M11 20c0-4 2-7 6-9" /></svg>),
  wheat: (s = 16) => (<svg {...base(s)}><path d="M12 22V8" /><path d="M12 8c2-2 5-2 5-5-3 0-5 1-5 3M12 8c-2-2-5-2-5-5 3 0 5 1 5 3M12 14c2-2 5-2 5-5-3 0-5 1-5 3M12 14c-2-2-5-2-5-5 3 0 5 1 5 3" /></svg>),
}
