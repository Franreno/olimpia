"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGridIcon,
  BarChart2Icon,
  PercentIcon,
  TagIcon,
  GlobeIcon,
  LayoutIcon,
  SettingsIcon,
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

const NAV_MODULES = [
  { href: "/inventario", label: "Inventário Turístico", icon: LayoutGridIcon },
  { href: "/demanda", label: "Pesquisa de Demanda", icon: BarChart2Icon },
  { href: "/ocupacao", label: "Taxa de Ocupação", icon: PercentIcon },
];

const NAV_DISABLED = [
  { label: "Diária Média", icon: TagIcon },
  { label: "Dados Externos", icon: GlobeIcon },
  { label: "Dashboard", icon: LayoutIcon },
  { label: "Configurações", icon: SettingsIcon },
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

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="size-8 rounded-lg bg-gradient-to-br from-primary to-[oklch(0.54_0.10_210)] flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-sm font-bold tracking-tight">
              OTO
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Observatório</p>
            <p className="text-xs text-muted-foreground leading-tight">
              Turismo Olímpia
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_MODULES.map(({ href, label, icon: Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    render={<Link href={href} />}
                    isActive={pathname.startsWith(href)}
                    tooltip={label}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Em breve</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_DISABLED.map(({ label, icon: Icon }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton disabled tooltip={label}>
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
