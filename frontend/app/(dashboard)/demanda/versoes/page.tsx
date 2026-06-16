"use client";

import Link from "next/link";
import { ArrowLeftIcon, TriangleAlertIcon, EyeIcon, LockIcon, CircleIcon } from "lucide-react";
import { useFormularios } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function FormVersionsPage() {
  const { data: versoes = [], isLoading } = useFormularios();
  const proximoAno = new Date().getFullYear() + 1;

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

      <div className="flex items-start gap-2.5 rounded-lg border border-warning bg-warning/10 px-4 py-3">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">
            O formulário ativo não pode ser modificado durante o ano em curso.
          </strong>{" "}
          Alterações no questionário (adição ou remoção de perguntas) só entram em
          vigor na versão do próximo ano, disponível a partir de janeiro de{" "}
          {proximoAno}.
        </p>
      </div>

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
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma versão de formulário cadastrada.
            </CardContent>
          </Card>
        )}

        {versoes.map((v) => {
          const ativo = v.status === "ativo";
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
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {ativo ? (
                        <CircleIcon className="size-2 fill-current" />
                      ) : (
                        <LockIcon className="size-3" />
                      )}
                      {ativo ? "Ativo" : "Bloqueado"}
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
                <Button variant="ghost" size="sm" disabled>
                  <EyeIcon data-icon="inline-start" />
                  Ver formulário
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
