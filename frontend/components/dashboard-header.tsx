"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const SECTION_LABELS: Record<string, string> = {
  inventario: "Inventário Turístico",
  demanda: "Pesquisa de Demanda",
  ocupacao: "Taxa de Ocupação",
};

const SUBSECTION_LABELS: Record<string, string> = {
  novo: "Novo estabelecimento",
  editar: "Editar",
  respondentes: "Controle de Respondentes",
  coletas: "Coletas de campo",
  resultados: "Resultados",
  versoes: "Versões do formulário",
  parques: "Parques",
  formulario: "Formulário de campo",
};

export function DashboardHeader() {
  const pathname = usePathname();

  const segments = pathname.split("/").filter(Boolean);
  const section = segments[0] ?? "";
  const sectionLabel = SECTION_LABELS[section];
  // Use the deepest recognised segment (e.g. ".../{id}/editar" → "Editar"),
  // falling back to "Detalhe" only for a bare record id.
  const knownSubs = segments
    .slice(1)
    .map((s) => SUBSECTION_LABELS[s])
    .filter(Boolean);
  const subLabel =
    segments.length > 1 ? (knownSubs.at(-1) ?? "Detalhe") : null;

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
    </header>
  );
}
