"use client";

import { useState } from "react";
import { DownloadIcon, FileSpreadsheetIcon } from "lucide-react";
import { useIndicadores, downloadExport, useParques } from "@/lib/queries";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { SerieNpsItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const npsChartConfig = {
  nps: { label: "NPS", color: "var(--primary)" },
} satisfies ChartConfig;

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

const ufLabel = (uf: string) => UF_NAMES[uf] ?? uf;

function npsColor(nps: number | null) {
  if (nps === null) return "text-muted-foreground";
  if (nps >= 50) return "text-success";
  if (nps >= 20) return "text-warning";
  return "text-danger";
}

export default function DemandaDashboardPage() {
  const { data: parques = [] } = useParques(true);
  const [selectedPark, setSelectedPark] = useState<string | null>(null);
  const ano = new Date().getFullYear();

  // derive the active park: explicit selection, else the first park
  const park = selectedPark ?? parques[0]?.slug ?? "";
  const setPark = setSelectedPark;
  const parkNome = parques.find((p) => p.slug === park)?.nome ?? "";

  const { data, isLoading } = useIndicadores(park || undefined, ano);

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Resultados da Demanda</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Indicadores consolidados por parque. Use a barra lateral para coletas,
          versões e parques.
        </p>
      </div>

      {/* Park toggle + export */}
      <div className="flex items-center justify-between">
        {parques.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            Nenhum parque cadastrado
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Parque:</span>
            <Select value={park || null} onValueChange={(v) => setPark(v as string)}>
              <SelectTrigger className="h-9 w-56">
                <SelectValue placeholder="Selecione o parque...">
                  {(value) =>
                    parques.find((p) => p.slug === value)?.nome ??
                    "Selecione o parque..."
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {parques.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExport("xlsx", park, ano)}
          >
            <FileSpreadsheetIcon data-icon="inline-start" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadExport("csv", park, ano)}
          >
            <DownloadIcon data-icon="inline-start" />
            CSV
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              NPS
            </p>
            {isLoading ? (
              <Skeleton className="h-11 w-20" />
            ) : (
              <div className="flex items-end gap-2">
                <span className={cn("text-4xl font-extrabold leading-none", npsColor(data?.nps ?? null))}>
                  {data?.nps ?? "—"}
                </span>
                {data?.nps_label && (
                  <Badge
                    className={cn(
                      "border-transparent",
                      (data.nps ?? 0) >= 50
                        ? "bg-success/15 text-success"
                        : (data.nps ?? 0) >= 20
                          ? "bg-warning/15 text-warning"
                          : "bg-danger/15 text-danger"
                    )}
                  >
                    {data.nps_label}
                  </Badge>
                )}
              </div>
            )}
            <p className="mt-1.5 text-xs text-muted-foreground">
              {ano} · {data?.total_respostas ?? 0} respostas
            </p>
          </CardContent>
        </Card>
        <StatCard label="Média de pernoites" value={data?.media_pernoites != null ? data.media_pernoites.toLocaleString("pt-BR") : "—"} sub="noites por visita" loading={isLoading} />
        <StatCard label="Ticket médio" value={data?.ticket_medio != null ? `R$ ${data.ticket_medio.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"} sub="gasto por viagem" loading={isLoading} />
        <StatCard label="Respostas coletadas" value={String(data?.total_respostas ?? 0)} sub={parkNome ? `${parkNome} · ${ano}` : String(ano)} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* NPS line chart */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm font-semibold">
              Evolução do NPS últimos 12 meses
            </p>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <NpsChart serie={data?.serie_nps ?? []} />
            )}
          </CardContent>
        </Card>

        {/* Top origin states */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm font-semibold">Top 5 estados de origem</p>
            {(data?.mercados_emissores ?? []).length === 0 && !isLoading && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sem dados ainda</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {(data?.mercados_emissores ?? []).map((m, i) => (
              <div key={m.rotulo} className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-foreground/80">{ufLabel(m.rotulo)}</span>
                  <span className="font-semibold text-primary">{m.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${m.pct}%`, opacity: 1 - i * 0.12 }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Competitors */}
      <Card>
        <CardContent className="p-4">
          <p className="mb-3.5 text-sm font-semibold">
            Destinos concorrentes mais considerados
          </p>
          {(data?.destinos_concorrentes ?? []).length === 0 && !isLoading ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Sem dados ainda</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-3">
              {(data?.destinos_concorrentes ?? []).slice(0, 3).map((c, i) => (
                <div key={c.rotulo} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="mb-1 text-xs text-muted-foreground">#{i + 1}</p>
                  <p className="mb-1 text-[15px] font-semibold">{c.rotulo}</p>
                  <p className="text-2xl font-bold text-primary">{c.pct}%</p>
                  <p className="text-xs text-muted-foreground">dos turistas consideraram</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <p className="text-3xl font-bold leading-none">{value}</p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function NpsChart({ serie }: { serie: SerieNpsItem[] }) {
  if (serie.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  }

  return (
    <ChartContainer config={npsChartConfig} className="h-[160px] w-full">
      <AreaChart accessibilityLayer data={serie} margin={{ left: 0, right: 8, top: 4 }}>
        <defs>
          <linearGradient id="fillNps" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-nps)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-nps)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(value: string) => value.split("/")[0]}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelKey="mes"
              formatter={(value, _name, item) => (
                <span>
                  NPS <strong>{value}</strong>
                  <span className="ml-1 text-muted-foreground">
                    ({item.payload.respostas} resp.)
                  </span>
                </span>
              )}
            />
          }
        />
        <Area
          dataKey="nps"
          type="monotone"
          stroke="var(--color-nps)"
          strokeWidth={2}
          fill="url(#fillNps)"
          dot={{ r: 2.5, fill: "var(--color-nps)" }}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
