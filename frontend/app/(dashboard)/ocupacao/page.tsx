"use client";

import Link from "next/link";
import { useState } from "react";
import { PlusIcon, EyeIcon } from "lucide-react";
import { usePeriodos } from "@/lib/queries";
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
import { NovoPeriodoDialog } from "@/components/novo-periodo-dialog";
import { cn } from "@/lib/utils";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2.5 min-w-[160px]">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct === 100 ? "bg-success" : pct >= 60 ? "bg-accent" : "bg-warning"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="whitespace-nowrap text-sm text-muted-foreground">
        {done} / {total}
      </span>
    </div>
  );
}

export default function OcupacaoPage() {
  const { data: periodos = [], isLoading } = usePeriodos();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const podeEditar = user?.perfil === "admin" || user?.perfil === "editor";

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Períodos de pesquisa</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os levantamentos mensais e de feriados da taxa de ocupação
            hoteleira.
          </p>
        </div>
        {podeEditar && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Novo período
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Respostas</TableHead>
                <TableHead>Taxa pond.</TableHead>
                <TableHead className="w-[140px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-36" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-24 rounded-full" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12" />
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))
                : periodos.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Link
                          href={`/ocupacao/${p.id}`}
                          className="font-medium hover:underline"
                        >
                          {p.descricao}
                        </Link>
                        {p.protocolo && (
                          <p className="text-xs text-muted-foreground">
                            Protocolo {p.protocolo}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "border-transparent",
                            p.tipo === "consolidado"
                              ? "bg-success/15 text-success"
                              : "bg-warning/15 text-warning"
                          )}
                        >
                          {p.tipo === "consolidado" ? "Consolidado" : "Esperado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          done={p.total_respondentes}
                          total={p.total_estabelecimentos}
                        />
                      </TableCell>
                      <TableCell>
                        {p.taxa_ponderada != null ? (
                          <span className="text-[15px] font-semibold text-primary">
                            {Number(p.taxa_ponderada).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          render={<Link href={`/ocupacao/${p.id}`} />}
                          nativeButton={false}
                        >
                          <EyeIcon data-icon="inline-start" />
                          Ver detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              {!isLoading && periodos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyTitle>Nenhum período cadastrado</EmptyTitle>
                      </EmptyHeader>
                    </Empty>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NovoPeriodoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
