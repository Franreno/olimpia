"use client";

import { useState } from "react";
import { InfoIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useCreatePeriodo } from "@/lib/queries";
import type { PeriodoTipo } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TIPOS: { id: PeriodoTipo; label: string; sub: string }[] = [
  { id: "consolidado", label: "Consolidado", sub: "Dados reais após o período" },
  { id: "expectativa", label: "Esperado", sub: "Previsão antes do período" },
];

/** Saturday (6) or Sunday (0) in UTC — matches the backend weekday() block. */
function isWeekend(iso: string): boolean {
  if (!iso) return false;
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function NovoPeriodoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<PeriodoTipo>("consolidado");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const createPeriodo = useCreatePeriodo();

  const weekendBlock =
    tipo === "expectativa" && (isWeekend(dataInicio) || isWeekend(dataFim));
  const canSubmit =
    descricao.trim() && dataInicio && dataFim && !weekendBlock && !createPeriodo.isPending;

  function reset() {
    setDescricao("");
    setTipo("consolidado");
    setDataInicio("");
    setDataFim("");
    createPeriodo.reset();
  }

  function handleSubmit() {
    createPeriodo.mutate(
      { tipo, descricao: descricao.trim(), data_inicio: dataInicio, data_fim: dataFim },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
      }
    );
  }

  const serverError =
    (createPeriodo.error as { response?: { data?: { detail?: string } } } | null)
      ?.response?.data?.detail ?? null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo período de pesquisa</DialogTitle>
          <DialogDescription>
            Os estabelecimentos são herdados automaticamente do Inventário.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="descricao">Nome do período</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Junho 2026 ou Corpus Christi 2026"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <div className="grid grid-cols-2 gap-2.5">
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    tipo === t.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      tipo === t.id && "text-primary"
                    )}
                  >
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{t.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data-inicio">Data de início</Label>
              <Input
                id="data-inicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="data-fim">Data de fim</Label>
              <Input
                id="data-fim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
              />
            </div>
          </div>

          {weekendBlock ? (
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3 text-warning">
              <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                Períodos de <strong>Esperado</strong> não podem cair em sábado ou
                domingo. Feriados prolongados em dias de semana devem ser
                cadastrados manualmente.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-muted-foreground">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <p className="text-xs leading-relaxed">
                Sábados e domingos que não sejam feriados prolongados{" "}
                <strong>não geram pesquisas do tipo Esperado</strong>{" "}
                automaticamente.
              </p>
            </div>
          )}

          {serverError && !weekendBlock && (
            <p className="text-xs text-danger">{serverError}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            <PlusIcon data-icon="inline-start" />
            {createPeriodo.isPending ? "Criando…" : "Criar período"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
