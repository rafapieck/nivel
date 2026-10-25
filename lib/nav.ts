export type NavItem = { href: string; label: string };

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Tinaco" },
  { href: "/historial", label: "Historial" },
  { href: "/pipa", label: "Pipa" },
  { href: "/ajustes", label: "Ajustes" },
];

// "/" matches only itself; other tabs also match their sub-routes.
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
