"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { useSubmitRespostaOcupacao } from "@/lib/queries";
import type { EstabelecimentoOcupacao } from "@/lib/types";
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

export function RegistrarRespostaDialog({
  periodoId,
  estabelecimento,
  open,
  onOpenChange,
}: {
  periodoId: number;
  estabelecimento: EstabelecimentoOcupacao | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {estabelecimento && (
          // Keyed by establishment so the form re-initialises from props on each
          // open without a state-syncing effect.
          <RespostaForm
            key={estabelecimento.empresa_id}
            periodoId={periodoId}
            estabelecimento={estabelecimento}
            onDone={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RespostaForm({
  periodoId,
  estabelecimento,
  onDone,
  onCancel,
}: {
  periodoId: number;
  estabelecimento: EstabelecimentoOcupacao;
  onDone: () => void;
  onCancel: () => void;
}) {
  const submit = useSubmitRespostaOcupacao(periodoId);
  const [taxa, setTaxa] = useState(
    estabelecimento.taxa_ocupacao != null ? String(estabelecimento.taxa_ocupacao) : ""
  );
  const [diaria, setDiaria] = useState(
    estabelecimento.diaria_media != null ? String(estabelecimento.diaria_media) : ""
  );
  const [observacao, setObservacao] = useState(estabelecimento.observacao ?? "");

  const taxaNum = Number(taxa);
  const taxaValid = taxa !== "" && taxaNum >= 0 && taxaNum <= 100;
  const canSubmit = taxaValid && !submit.isPending;

  function handleSubmit() {
    submit.mutate(
      {
        empresa_id: estabelecimento.empresa_id,
        taxa_ocupacao: Number(taxa),
        ...(diaria !== "" && { diaria_media: Number(diaria) }),
        ...(observacao.trim() && { observacao: observacao.trim() }),
      },
      { onSuccess: onDone }
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Registrar resposta</DialogTitle>
        <DialogDescription>{estabelecimento.nome_fantasia}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">UHs</p>
            <p className="font-medium">{estabelecimento.uhs ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Leitos (peso)</p>
            <p className="font-medium">
              {estabelecimento.leitos ?? "—"}{" "}
              <span className="text-xs text-muted-foreground">
                ({estabelecimento.peso.toFixed(2)}%)
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="taxa">Taxa de ocupação (%)</Label>
          <Input
            id="taxa"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={taxa}
            onChange={(e) => setTaxa(e.target.value)}
            placeholder="0 – 100"
          />
          {taxa !== "" && !taxaValid && (
            <p className="text-xs text-danger">Informe um valor entre 0 e 100.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="diaria">Diária média (R$)</Label>
          <Input
            id="diaria"
            type="number"
            min={0}
            step="0.01"
            value={diaria}
            onChange={(e) => setDiaria(e.target.value)}
            placeholder="Opcional — usada na receita estimada"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obs">Observação</Label>
          <Input
            id="obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={!canSubmit} onClick={handleSubmit}>
          <CheckIcon data-icon="inline-start" />
          {submit.isPending ? "Salvando…" : "Salvar resposta"}
        </Button>
      </DialogFooter>
    </>
  );
}
