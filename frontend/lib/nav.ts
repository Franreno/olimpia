import type { AuthUser } from "./auth";

export type Perfil = AuthUser["perfil"];

/**
 * Where each persona should land after login / on "/".
 *
 * A `pesquisador` can only submit field surveys — the analytics dashboard is
 * useless to them — so they go straight to their collection launcher. Everyone
 * else starts on the inventory.
 */
export function homeForRole(perfil: Perfil): string {
  if (perfil === "pesquisador") return "/demanda/coletas";
  return "/inventario";
}

export interface DemandaNavItem {
  href: string;
  label: string;
  /** Roles allowed to see this entry. */
  roles: Perfil[];
}

/**
 * Sub-navigation for the Pesquisa de Demanda module, role-aware.
 * Order reflects each persona's primary job first.
 */
export const DEMANDA_NAV: DemandaNavItem[] = [
  // Field researcher's daily job — listed first so it's the obvious action.
  { href: "/demanda/coletas", label: "Coletas", roles: ["admin", "editor", "pesquisador"] },
  // Manager's analytics — read + export.
  { href: "/demanda", label: "Resultados", roles: ["admin", "editor", "gestor"] },
  // Coordinator's once-a-year configuration.
  { href: "/demanda/versoes", label: "Versões", roles: ["admin", "editor"] },
  { href: "/demanda/parques", label: "Parques", roles: ["admin", "editor"] },
];

/** The Demanda landing for a given role (first sub-item they're allowed to see). */
export function demandaHomeForRole(perfil: Perfil): string {
  return DEMANDA_NAV.find((i) => i.roles.includes(perfil))?.href ?? "/demanda";
}
