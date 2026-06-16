"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellIcon } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";

const SECTION_LABELS: Record<string, string> = {
  inventario: "Inventário Turístico",
  demanda: "Pesquisa de Demanda",
  ocupacao: "Taxa de Ocupação",
};

const SUBSECTION_LABELS: Record<string, string> = {
  novo: "Novo estabelecimento",
  editar: "Editar",
  versoes: "Versões do formulário",
  parques: "Parques",
  formulario: "Formulário de campo",
};

function initials(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function DashboardHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] ?? "";
  const sub = segments[1];
  const sectionLabel = SECTION_LABELS[section];
  const subLabel = sub ? (SUBSECTION_LABELS[sub] ?? "Detalhe") : null;

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-white px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          <BreadcrumbItem>
            {subLabel ? (
              <BreadcrumbLink render={<Link href={`/${section}`} />}>
                {sectionLabel}
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage className="font-medium text-foreground">
                {sectionLabel}
              </BreadcrumbPage>
            )}
          </BreadcrumbItem>
          {subLabel && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{subLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-1.5">
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted"
          aria-label="Notificações"
        >
          <BellIcon className="size-5" />
        </button>
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {user ? initials(user.nome) : "?"}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
