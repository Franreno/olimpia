"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  CircleIcon,
  LockIcon,
  PlusIcon,
  AsteriskIcon,
  ListChecksIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useFormularios } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import type { CampoFormulario } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIPO_LABEL: Record<CampoFormulario["tipo"], string> = {
  selecao: "Seleção única",
  multipla: "Múltipla escolha",
  autocomplete: "Autocomplete",
  numero: "Número",
  escala: "Escala",
};

type Opcao = string | { valor: string; rotulo: string };

function optionLabel(o: Opcao) {
  return typeof o === "string" ? o : (o.rotulo ?? o.valor);
}

function CampoCard({ campo, ordem }: { campo: CampoFormulario; ordem: number }) {
  const opcoes = (campo.opcoes ?? []) as Opcao[];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {ordem}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{campo.label}</span>
              {campo.obrigatorio && (
                <Badge className="gap-0.5 border-transparent bg-danger/10 text-danger">
                  <AsteriskIcon className="size-3" />
                  Obrigatório
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded bg-accent px-1.5 py-0.5 font-medium text-accent-foreground">
                {TIPO_LABEL[campo.tipo] ?? campo.tipo}
              </span>
              {campo.tipo === "numero" &&
                (campo.min != null || campo.max != null) && (
                  <span>
                    intervalo {campo.min ?? "—"} a {campo.max ?? "—"}
                  </span>
                )}
              {campo.tipo === "escala" && (
                <span>
                  escala {campo.min ?? 0}–{campo.max ?? 10}
                </span>
              )}
              {campo.fonte && <span>fonte: {campo.fonte.toUpperCase()}</span>}
            </div>

            {opcoes.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {opcoes.map((o, i) => (
                  <span
                    key={i}
                    className="rounded-md border bg-muted/40 px-2 py-0.5 text-xs text-foreground/80"
                  >
                    {optionLabel(o)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FormularioDetailPage() {
  const params = useParams<{ ano: string }>();
  const ano = Number(params.ano);
  const { data: versoes, isLoading, isError } = useFormularios();
  const form = versoes?.find((v) => v.ano === ano);

  const anoAtual = new Date().getFullYear();
  const ativo = form?.ano === anoAtual && form?.status === "ativo";
  const emPreparacao = !!form && form.ano > anoAtual;

  const campos = form?.schema_json?.campos ?? [];
  const regras = form?.schema_json?.regras_coerencia ?? [];

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/demanda/versoes" />}
        nativeButton={false}
        className="self-start"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Voltar às versões
      </Button>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError || !form ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Formulário não encontrado</EmptyTitle>
            <EmptyDescription>
              Não existe uma versão do formulário para o ano {params.ano}.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {/* Summary header */}
          <Card className={cn(ativo && "border-primary/30")}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold">Formulário {form.ano}</h1>
                <Badge
                  className={cn(
                    "gap-1 border-transparent",
                    ativo
                      ? "bg-success/15 text-success"
                      : emPreparacao
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {ativo ? (
                    <CircleIcon className="size-2 fill-current" />
                  ) : emPreparacao ? (
                    <PlusIcon className="size-3" />
                  ) : (
                    <LockIcon className="size-3" />
                  )}
                  {ativo ? "Ativo" : emPreparacao ? "Em preparação" : "Bloqueado"}
                </Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{campos.length} perguntas</span>
                <span>·</span>
                <span>
                  {form.total_respostas.toLocaleString("pt-BR")} respostas
                  coletadas
                </span>
                {form.criado_por_nome && (
                  <>
                    <span>·</span>
                    <span>Criado por {form.criado_por_nome}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {!emPreparacao && (
            <Alert variant="warning">
              <TriangleAlertIcon />
              <AlertDescription>
                Esta versão está em uso e não pode ser modificada. Alterações no
                questionário só entram em vigor na versão do próximo ano.
              </AlertDescription>
            </Alert>
          )}

          {/* Questions */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ListChecksIcon className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Perguntas</h2>
            </div>
            {campos.length === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyTitle>Sem perguntas configuradas</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {campos.map((c, i) => (
                  <CampoCard key={c.id} campo={c} ordem={i + 1} />
                ))}
              </div>
            )}
          </div>

          {/* Coherence rules */}
          {regras.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <TriangleAlertIcon className="size-4 text-warning" />
                <h2 className="text-sm font-semibold">Regras de coerência</h2>
              </div>
              <div className="flex flex-col gap-2">
                {regras.map((r, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{r.campo}</span>
                        <span className="rounded bg-warning/10 px-1.5 py-0.5 font-medium text-warning">
                          {r.tipo}
                        </span>
                        {r.fator != null && <span>fator {r.fator}</span>}
                      </div>
                      <p className="mt-2 text-sm text-foreground/80">
                        “{r.alerta}”
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
