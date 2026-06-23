"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckIcon,
  DownloadIcon,
  RefreshCwIcon,
  XIcon,
} from "lucide-react";
import { useRespondentes, useSincronizarRespondentes } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  TablePagination,
  TableSearch,
  useTableData,
} from "@/components/table-pagination";
import type { RespondentesMatrix } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

function rateColor(rate: number) {
  if (rate >= 70) return "bg-success";
  if (rate >= 40) return "bg-warning";
  return "bg-danger";
}

function exportCsv(matrix: RespondentesMatrix) {
  const header = [
    "estabelecimento",
    "contato",
    "protocolo",
    ...matrix.periodos.map((p) => p.descricao),
    "taxa_participacao_pct",
  ];
  const lines = matrix.respondentes.map((r) =>
    [
      r.nome_fantasia,
      r.contato ?? "",
      r.protocolo ?? "",
      ...r.participacao.map((p) => (p ? "sim" : "nao")),
      String(r.taxa_participacao),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `respondentes_${matrix.ano}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default function RespondentesPage() {
  const { data, isLoading } = useRespondentes();
  const { user } = useAuth();
  const sincronizar = useSincronizarRespondentes();
  const podeEditar = user?.perfil === "admin" || user?.perfil === "editor";

  const periodos = data?.periodos ?? [];
  const respondentes = data?.respondentes ?? [];

  const {
    query,
    setQuery,
    page,
    setPage,
    pageItems,
    pageCount,
    total,
  } = useTableData({
    data: respondentes,
    pageSize: PAGE_SIZE,
    searchFields: (r) => [r.nome_fantasia, r.contato, r.protocolo],
  });

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/inventario" />}
        nativeButton={false}
        className="self-start"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Voltar ao inventário
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Controle de Respondentes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Participação dos meios de hospedagem nas pesquisas de taxa de ocupação
            {data ? ` — ${data.ano}` : ""}.
          </p>
        </div>
        <div className="flex gap-2">
          {podeEditar && (
            <Button
              variant="outline"
              size="sm"
              disabled={sincronizar.isPending}
              onClick={() => sincronizar.mutate()}
            >
              <RefreshCwIcon data-icon="inline-start" />
              {sincronizar.isPending ? "Sincronizando…" : "Sincronizar do inventário"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!data || respondentes.length === 0}
            onClick={() => data && exportCsv(data)}
          >
            <DownloadIcon data-icon="inline-start" />
            Exportar
          </Button>
        </div>
      </div>

      {!isLoading && respondentes.length > 0 && (
        <TableSearch
          value={query}
          onChange={setQuery}
          placeholder="Buscar por nome, contato ou protocolo..."
          className="max-w-sm"
        />
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-center">Protocolo</TableHead>
                {periodos.map((p) => (
                  <TableHead key={p.id} className="whitespace-nowrap text-center">
                    {p.descricao}
                  </TableHead>
                ))}
                <TableHead className="min-w-[140px]">Taxa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4 + periodos.length}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : total === 0 ? (
                <TableRow>
                  <TableCell colSpan={4 + periodos.length}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>
                          {query
                            ? "Nenhum respondente corresponde à busca"
                            : "Nenhum meio de hospedagem ativo no inventário"}
                        </EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              ) : (
                pageItems.map((row) => (
                  <TableRow key={row.empresa_id}>
                    <TableCell className="font-medium">{row.nome_fantasia}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.contato ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.protocolo ? (
                        <Badge variant="secondary">{row.protocolo}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {row.participacao.map((participou, j) => (
                      <TableCell key={periodos[j]?.id ?? j} className="text-center">
                        <span
                          className={cn(
                            "inline-flex size-5.5 items-center justify-center rounded-full",
                            participou
                              ? "bg-success/15 text-success"
                              : "bg-muted text-muted-foreground/40"
                          )}
                        >
                          {participou ? (
                            <CheckIcon className="size-3" />
                          ) : (
                            <XIcon className="size-3" />
                          )}
                        </span>
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", rateColor(row.taxa_participacao))}
                            style={{ width: `${row.taxa_participacao}%` }}
                          />
                        </div>
                        <span className="min-w-[34px] text-xs text-muted-foreground">
                          {row.taxa_participacao}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {!isLoading && (
            <TablePagination
              page={page}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              itemLabel="respondentes"
            />
          )}
        </CardContent>
      </Card>

      {periodos.length === 0 && !isLoading && respondentes.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum período de ocupação cadastrado em {data?.ano} ainda — crie períodos
          no módulo Taxa de Ocupação para acompanhar a participação.
        </p>
      )}
    </>
  );
}
