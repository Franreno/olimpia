"use client";

import Link from "next/link";
import { useState } from "react";
import { PlusIcon, DownloadIcon, SearchIcon } from "lucide-react";
import { useEmpresas, useCategorias } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CAT_SHORT: Record<string, string> = {
  meios_hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  atrativos: "Atrativos",
  agencias: "Agências",
  transporte: "Transporte",
  eventos: "Eventos",
  servicos_apoio: "Apoio",
};

export default function InventarioPage() {
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<number | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data: categorias = [] } = useCategorias();
  const { data: empresas = [], isLoading } = useEmpresas({
    ...(catFilter !== undefined && { categoria_id: catFilter }),
    ...(statusFilter && { status: statusFilter }),
    ...(q && { q }),
  });

  const hasFilters = catFilter !== undefined || statusFilter !== undefined;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Inventário Turístico</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <DownloadIcon data-icon="inline-start" />
            Exportar
          </Button>
          <Button
            size="sm"
            render={<Link href="/inventario/novo" />}
            nativeButton={false}
          >
            <PlusIcon data-icon="inline-start" />
            Novo estabelecimento
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative max-w-xs">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar estabelecimento..."
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Categoria:</span>
          {categorias.map((cat) => (
            <button
              key={cat.id}
              onClick={() =>
                setCatFilter(catFilter === cat.id ? undefined : cat.id)
              }
              className={cn(
                "rounded-full border px-3 py-0.5 text-xs transition-colors",
                catFilter === cat.id
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {CAT_SHORT[cat.slug] ?? cat.nome}
            </button>
          ))}
          <div className="mx-1 h-4 w-px bg-border" />
          <span className="text-xs text-muted-foreground">Status:</span>
          {["ativo", "inativo"].map((s) => (
            <button
              key={s}
              onClick={() =>
                setStatusFilter(statusFilter === s ? undefined : s)
              }
              className={cn(
                "rounded-full border px-3 py-0.5 text-xs transition-colors",
                statusFilter === s
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {s === "ativo" ? "Ativo" : "Inativo"}
            </button>
          ))}
          {hasFilters && (
            <button
              onClick={() => {
                setCatFilter(undefined);
                setStatusFilter(undefined);
              }}
              className="text-xs text-primary underline"
            >
              Limpar filtros
            </button>
          )}
        </div>

        {/* Count */}
        {!isLoading && (
          <p className="text-xs text-muted-foreground">
            {empresas.length} estabelecimento{empresas.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead className="w-[160px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-14 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                : empresas.map((emp) => (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell>
                        <Link
                          href={`/inventario/${emp.id}`}
                          className="hover:underline"
                        >
                          <p className="font-medium">{emp.nome_fantasia}</p>
                          {emp.razao_social && (
                            <p className="text-xs text-muted-foreground">
                              {emp.razao_social}
                            </p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-[#E8F4F8] text-[#2E86AB] border-transparent hover:bg-[#E8F4F8]">
                          {CAT_SHORT[
                            categorias.find((c) => c.id === emp.categoria_id)
                              ?.slug ?? ""
                          ] ??
                            categorias.find((c) => c.id === emp.categoria_id)
                              ?.nome ??
                            "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            emp.status === "ativo" ? "default" : "secondary"
                          }
                          className={
                            emp.status === "ativo"
                              ? "bg-[--success]/15 text-[--success] hover:bg-[--success]/20 border-transparent"
                              : "text-muted-foreground"
                          }
                        >
                          {emp.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {emp.atualizado_em
                          ? new Date(emp.atualizado_em).toLocaleDateString(
                              "pt-BR"
                            )
                          : new Date(emp.criado_em).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link href={`/inventario/${emp.id}`} />}
                            nativeButton={false}
                          >
                            Ver
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            render={<Link href={`/inventario/${emp.id}/editar`} />}
                            nativeButton={false}
                          >
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && empresas.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Nenhum estabelecimento encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
