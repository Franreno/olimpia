"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGridIcon,
  BarChart2Icon,
  PercentIcon,
  LogOutIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { DEMANDA_NAV, demandaHomeForRole, type Perfil } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavModule = {
  href: string;
  label: string;
  icon: typeof LayoutGridIcon;
  /** Roles allowed to see this module. */
  roles: Perfil[];
};

const NAV_MODULES: NavModule[] = [
  {
    href: "/inventario",
    label: "Inventário Turístico",
    icon: LayoutGridIcon,
    roles: ["admin", "editor", "gestor"],
  },
  {
    href: "/demanda",
    label: "Pesquisa de Demanda",
    icon: BarChart2Icon,
    roles: ["admin", "editor", "gestor", "pesquisador"],
  },
  {
    href: "/ocupacao",
    label: "Taxa de Ocupação",
    icon: PercentIcon,
    roles: ["admin", "editor", "gestor"],
  },
];

function initials(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const PERFIL_LABEL: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  pesquisador: "Pesquisador",
  gestor: "Gestor",
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const router = useRouter();
  const perfil = user?.perfil;
  const modules = perfil
    ? NAV_MODULES.filter((m) => m.roles.includes(perfil))
    : [];

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent-strong shadow-sm">
            <span className="text-sm font-bold tracking-tight text-primary-foreground">
              OTO
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              Observatório
            </p>
            <p className="truncate text-xs text-muted-foreground leading-tight">
              Turismo de Olímpia
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {modules.map(({ href, label, icon: Icon }) => {
                const sectionActive = pathname.startsWith(href);
                const isDemanda = href === "/demanda";
                // Land each persona on the right Demanda sub-page.
                const parentHref =
                  isDemanda && perfil ? demandaHomeForRole(perfil) : href;
                const subItems =
                  isDemanda && perfil
                    ? DEMANDA_NAV.filter((i) => i.roles.includes(perfil))
                    : [];
                const hasSubs = subItems.length > 0;
                // When a section expands its sub-items, the active sub-item is
                // the single highlight — the parent becomes a subtle label so we
                // don't stack two filled pills on top of each other.
                const parentExpanded = sectionActive && hasSubs;

                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      render={<Link href={parentHref} />}
                      isActive={sectionActive && !hasSubs}
                      tooltip={label}
                      className={cn(
                        parentExpanded &&
                          "font-medium text-sidebar-accent-foreground hover:bg-transparent [&>svg]:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                    {parentExpanded && (
                      <SidebarMenuSub>
                        {subItems.map((item) => (
                          <SidebarMenuSubItem key={item.href}>
                            <SidebarMenuSubButton
                              render={<Link href={item.href} />}
                              isActive={
                                item.href === "/demanda"
                                  ? pathname === "/demanda"
                                  : pathname.startsWith(item.href)
                              }
                            >
                              <span>{item.label}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="cursor-pointer"
                    aria-label="Opções do usuário"
                  />
                }
              >
                <Avatar className="size-7 rounded-full">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                    {user ? initials(user.nome) : "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left leading-tight">
                  <span className="truncate text-sm font-medium">
                    {user?.nome}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user ? PERFIL_LABEL[user.perfil] : ""}
                  </span>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-destructive cursor-pointer"
                >
                  <LogOutIcon />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
