"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeftIcon, DownloadIcon, InfoIcon, PencilIcon } from "lucide-react";
import {
  usePeriodo,
  useResultadoOcupacao,
  useEstabelecimentosOcupacao,
  downloadOcupacaoExport,
} from "@/lib/queries";
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
import { RegistrarRespostaDialog } from "@/components/registrar-resposta-dialog";
import {
  TablePagination,
  TableSearch,
  useTableData,
} from "@/components/table-pagination";
import type { EstabelecimentoOcupacao, EstabelecimentoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const STATUS_META: Record<
  EstabelecimentoStatus,
  { label: string; className: string }
> = {
  respondeu: { label: "Respondeu", className: "bg-success/15 text-success" },
  pendente: { label: "Pendente", className: "bg-warning/15 text-warning" },
  nao_responde: { label: "Não responde", className: "bg-muted text-muted-foreground" },
};

function formatReceita(value: number | null): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
  return `R$ ${value.toFixed(0)}`;
}

export default function OcupacaoDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const podeEditar = user?.perfil === "admin" || user?.perfil === "editor";

  const { data: periodo, isLoading: loadingPeriodo } = usePeriodo(id);
  const { data: resultado } = useResultadoOcupacao(id);
  const { data: estabelecimentos = [], isLoading: loadingEstab } =
    useEstabelecimentosOcupacao(id);

  const [selecionado, setSelecionado] = useState<EstabelecimentoOcupacao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const responderam = estabelecimentos.filter((e) => e.status === "respondeu").length;

  const {
    query,
    setQuery,
    page: safePage,
    setPage,
    pageItems: pageEstab,
    pageCount,
    total,
  } = useTableData({
    data: estabelecimentos,
    pageSize: PAGE_SIZE,
    searchFields: (e) => [e.nome_fantasia],
  });

  function abrirResposta(estab: EstabelecimentoOcupacao) {
    setSelecionado(estab);
    setDialogOpen(true);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/ocupacao" />}
        nativeButton={false}
        className="self-start"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Voltar aos períodos
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        {loadingPeriodo ? (
          <Skeleton className="h-7 w-48" />
        ) : (
          <>
            <h1 className="text-xl font-bold">{periodo?.descricao}</h1>
            {periodo && (
              <Badge
                className={cn(
                  "border-transparent",
                  periodo.tipo === "consolidado"
                    ? "bg-success/15 text-success"
                    : "bg-warning/15 text-warning"
                )}
              >
                {periodo.tipo === "consolidado" ? "Consolidado" : "Esperado"}
              </Badge>
            )}
            {periodo?.protocolo && (
              <span className="text-sm text-muted-foreground">
                Protocolo {periodo.protocolo}
              </span>
            )}
          </>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Taxa ponderada
            </p>
            <p className="text-4xl font-extrabold leading-none text-primary">
              {resultado?.taxa_ponderada != null
                ? `${Number(resultado.taxa_ponderada).toFixed(1)}%`
                : "—"}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Média ponderada pelos leitos
            </p>
          </CardContent>
        </Card>
        <StatCard
          label="Receita estimada"
          value={formatReceita(resultado?.receita_estimada ?? null)}
          sub={
            resultado?.qtd_diarias
              ? `Base: ${resultado.qtd_diarias} ${resultado.qtd_diarias === 1 ? "diária" : "diárias"} no período`
              : "Estimativa do período"
          }
        />
        <StatCard
          label="Responderam"
          value={`${responderam} / ${estabelecimentos.length}`}
          sub="Estabelecimentos que responderam"
        />
        <StatCard
          label="Leitos cadastrados"
          value={(resultado?.total_leitos_inventario ?? 0).toLocaleString("pt-BR")}
          sub="Total do inventário ativo"
        />
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 rounded-lg bg-primary/5 p-3.5">
        <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed text-primary">
          O peso de cada estabelecimento vem do seu número de leitos no inventário.
        </p>
      </div>

      {/* Establishments table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold">Estabelecimentos</span>
            <div className="flex items-center gap-2">
              <TableSearch
                value={query}
                onChange={setQuery}
                placeholder="Buscar estabelecimento..."
                className="max-w-[220px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadOcupacaoExport(id)}
              >
                <DownloadIcon data-icon="inline-start" />
                Exportar CSV
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>UHs</TableHead>
                <TableHead>Leitos</TableHead>
                <TableHead>% dos leitos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Taxa declarada</TableHead>
                <TableHead>Receita est.</TableHead>
                {podeEditar && <TableHead className="w-[120px]" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingEstab ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={podeEditar ? 8 : 7}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : total === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={podeEditar ? 8 : 7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    {query
                      ? "Nenhum estabelecimento corresponde à busca."
                      : "Nenhum estabelecimento neste período."}
                  </TableCell>
                </TableRow>
              ) : (
                pageEstab.map((e) => {
                    const meta = STATUS_META[e.status];
                    const taxa = e.taxa_ocupacao != null ? Number(e.taxa_ocupacao) : null;
                    return (
                      <TableRow key={e.empresa_id}>
                        <TableCell className="font-medium">
                          {e.nome_fantasia}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.uhs ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {e.leitos ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium text-accent-strong">
                          {e.peso.toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("border-transparent", meta.className)}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {taxa != null ? (
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-14 rounded-full bg-muted">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    taxa >= 80
                                      ? "bg-success"
                                      : taxa >= 60
                                        ? "bg-accent-strong"
                                        : "bg-warning"
                                  )}
                                  style={{ width: `${taxa}%` }}
                                />
                              </div>
                              <span className="text-sm font-semibold">
                                {taxa.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Aguardando
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatReceita(e.receita_estimada)}
                        </TableCell>
                        {podeEditar && (
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirResposta(e)}
                            >
                              <PencilIcon data-icon="inline-start" />
                              {e.status === "respondeu" ? "Editar" : "Responder"}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
          {!loadingEstab && (
            <TablePagination
              page={safePage}
              pageCount={pageCount}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              itemLabel="estabelecimentos"
            />
          )}
        </CardContent>
      </Card>

      <RegistrarRespostaDialog
        periodoId={id}
        estabelecimento={selecionado}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-3xl font-bold leading-none">{value}</p>
        <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
