"use client";

import Link from "next/link";
import { ArrowLeftIcon, TriangleAlertIcon, EyeIcon, LockIcon, CircleIcon, PlusIcon } from "lucide-react";
import { useFormularios, useCreateFormulario } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export default function FormVersionsPage() {
  const { data: versoes = [], isLoading } = useFormularios();
  const { user } = useAuth();
  const createFormulario = useCreateFormulario();
  const proximoAno = new Date().getFullYear() + 1;
  const podeEditar = user?.perfil === "admin" || user?.perfil === "editor";
  const proximoExiste = versoes.some((v) => v.ano === proximoAno);

  function prepararProximaVersao(schema: (typeof versoes)[number]["schema_json"]) {
    createFormulario.mutate({ ano: proximoAno, schema_json: schema });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        render={<Link href="/demanda" />}
        nativeButton={false}
        className="self-start"
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Voltar aos resultados
      </Button>

      <div>
        <h1 className="text-xl font-bold">Versões do formulário</h1>
        <p className="text-sm text-muted-foreground">
          Cada ano possui uma versão do formulário. Somente a versão ativa pode
          receber respostas.
        </p>
      </div>

      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>
          O formulário ativo não pode ser modificado durante o ano em curso.
        </AlertTitle>
        <AlertDescription>
          Alterações no questionário (adição ou remoção de perguntas) só entram em
          vigor na versão do próximo ano, disponível a partir de janeiro de{" "}
          {proximoAno}.
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-3">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-48" />
              </CardContent>
            </Card>
          ))}

        {!isLoading && versoes.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Nenhuma versão de formulário cadastrada</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {versoes.map((v) => {
          const anoAtual = new Date().getFullYear();
          const ativo = v.ano === anoAtual && v.status === "ativo";
          const emPreparacao = v.ano > anoAtual;
          return (
            <Card
              key={v.id}
              className={cn(ativo && "border-primary/30")}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="mb-1.5 flex items-center gap-2.5">
                    <span className="text-lg font-bold">Formulário {v.ano}</span>
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
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span>{v.schema_json?.campos?.length ?? 0} perguntas</span>
                    <span>·</span>
                    <span>
                      {v.total_respostas.toLocaleString("pt-BR")} respostas
                      coletadas
                    </span>
                    {v.criado_por_nome && (
                      <>
                        <span>·</span>
                        <span>Criado por {v.criado_por_nome}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="sm" disabled>
                    <EyeIcon data-icon="inline-start" />
                    Ver formulário
                  </Button>
                  {ativo && podeEditar && !proximoExiste && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={createFormulario.isPending}
                      onClick={() => prepararProximaVersao(v.schema_json)}
                    >
                      <PlusIcon data-icon="inline-start" />
                      {createFormulario.isPending
                        ? "Preparando…"
                        : `Preparar versão ${proximoAno}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
