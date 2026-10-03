// Local, consistent 24px outline icons: no icon fonts or external requests.
const shapes = {
  dashboard:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="18" width="7" height="3" rx="1"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2"/>',
  clipboard:
    '<rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="m8 12 1 1 2-2M13 12h3m-8 5 1 1 2-2M13 17h3"/>',
  users:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 4v2"/>',
  sparkle:
    '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 3v4m-2-2h4"/>',
  gallery:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21M3 16l4-4 4 4"/>',
  blocked: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  settings:
    '<path d="m9.5 3-.7 2-2 .9-2-.4-2.4 4 1.4 1.6v2l-1.4 1.6 2.4 4 2-.4 2 .9.7 2h5l.7-2 2-.9 2 .4 2.4-4-1.4-1.6v-2l1.4-1.6-2.4-4-2 .4-2-.9-.7-2z"/><circle cx="12" cy="12" r="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  wallet:
    '<path d="M20 7V5a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v13a2 2 0 0 0 2 2h15V7H6a1 1 0 0 1 0-2"/><path d="M20 11h-5v6h5M17 14h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  external:
    '<path d="M15 3h6v6M10 14 21 3M11 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6"/>',
  logout:
    '<path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4M13 8l5 4-5 4M8 12h13"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  database:
    '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
  wifiOff:
    '<path d="m3 3 18 18M8.5 16.5a5 5 0 0 1 7 0M5 12a10 10 0 0 1 5-2.6M16 10.6a10 10 0 0 1 3 1.4M2 8a16 16 0 0 1 4-2M10 4.2A16 16 0 0 1 22 8M12 20h.01"/>',
  edit: '<path d="m16 3 5 5L9 20l-6 1 1-6L16 3ZM13 6l5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
};
export function icon(name, className = "") {
  return `<svg class="ui-icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${shapes[name] || shapes.sparkle}</svg>`;
}
