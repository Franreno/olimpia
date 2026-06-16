"use client";

import Link from "next/link";
import { useState } from "react";
import { DownloadIcon, ClipboardListIcon, FileSpreadsheetIcon } from "lucide-react";
import { useIndicadores, downloadExport } from "@/lib/queries";
import { PARQUE_LABELS, type Parque } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PARK_TABS: Parque[] = ["thermas", "rubio", "hot_beach", "dolce_dulce"];

function npsColor(nps: number | null) {
  if (nps === null) return "text-muted-foreground";
  if (nps >= 50) return "text-success";
  if (nps >= 20) return "text-warning";
  return "text-danger";
}

export default function DemandaDashboardPage() {
  const [park, setPark] = useState<Parque>("thermas");
  const ano = new Date().getFullYear();
  const { data, isLoading } = useIndicadores(park, ano);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Pesquisa de Demanda</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/demanda/formulario" />}
            nativeButton={false}
          >
            <ClipboardListIcon data-icon="inline-start" />
            Novo formulário
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/demanda/versoes" />}
            nativeButton={false}
          >
            Versões
          </Button>
        </div>
      </div>

      {/* Park toggle + export */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {PARK_TABS.map((p) => (
            <button
              key={p}
              onClick={() => setPark(p)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm transition-all",
                park === p
                  ? "bg-background font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {PARQUE_LABELS[p]}
            </button>
          ))}
        </div>
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
              NPS Score
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
        <StatCard label="Respostas coletadas" value={String(data?.total_respostas ?? 0)} sub={String(ano)} loading={isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* NPS line chart */}
        <Card>
          <CardContent className="p-4">
            <p className="mb-4 text-sm font-semibold">
              Evolução do NPS — últimos 12 meses
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
            <p className="mb-4 text-sm font-semibold">Principais mercados emissores</p>
            {(data?.mercados_emissores ?? []).length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            )}
            {(data?.mercados_emissores ?? []).map((m, i) => (
              <div key={m.rotulo} className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-foreground/80">{m.rotulo}</span>
                  <span className="font-semibold text-primary">{m.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-accent-foreground/70")}
                    style={{ width: `${m.pct}%` }}
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
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-3">
              {(data?.destinos_concorrentes ?? []).slice(0, 3).map((c, i) => (
                <div key={c.rotulo} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="mb-1 text-xs text-muted-foreground">#{i + 1}</p>
                  <p className="mb-1 text-[15px] font-semibold">{c.rotulo}</p>
                  <p className="text-2xl font-bold text-[oklch(0.54_0.10_210)]">{c.pct}%</p>
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

function NpsChart({ serie }: { serie: { mes: string; nps: number }[] }) {
  if (serie.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados ainda.</p>;
  }
  const W = 480;
  const H = 100;
  const min = 0;
  const max = 100;
  const pts = serie.map((m, i) => {
    const x = (i / Math.max(serie.length - 1, 1)) * W;
    const y = H - ((m.nps - min) / (max - min)) * H;
    return { x, y, ...m };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${H} L 0 ${H} Z`;

  return (
    <div className="overflow-x-auto">
      <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} className="block">
        {[20, 40, 60, 80].map((v) => {
          const y = H - ((v - min) / (max - min)) * H;
          return (
            <g key={v}>
              <line x1="0" y1={y} x2={W} y2={y} stroke="currentColor" className="text-muted" strokeWidth="1" />
              <text x="0" y={y - 3} fontSize="9" className="fill-muted-foreground">
                {v}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="npsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#npsGrad)" />
        <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill="var(--primary)" />
            <text x={p.x} y={H + 16} textAnchor="middle" fontSize="9" className="fill-muted-foreground">
              {p.mes.split("/")[0]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
