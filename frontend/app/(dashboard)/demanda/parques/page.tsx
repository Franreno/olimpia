"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftIcon, PlusIcon, CheckIcon, MapPinIcon } from "lucide-react";
import {
  useParques,
  useCreateParque,
  useUpdateParque,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { Parque } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export default function ParquesPage() {
  const { data: parques = [], isLoading } = useParques();
  const { user } = useAuth();
  const createParque = useCreateParque();
  const [novoNome, setNovoNome] = useState("");

  const podeEditar = user?.perfil === "admin" || user?.perfil === "editor";

  async function adicionar() {
    const nome = novoNome.trim();
    if (!nome) return;
    await createParque.mutateAsync({ nome });
    setNovoNome("");
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
        <h1 className="text-xl font-bold">Parques / Locais de pesquisa</h1>
        <p className="text-sm text-muted-foreground">
          Adicione, renomeie ou desative os locais de pesquisa.
        </p>
      </div>

      {podeEditar && (
        <Card>
          <CardContent className="flex items-end gap-3 p-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Novo parque
              </label>
              <Input
                placeholder="Nome do parque / local"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") adicionar();
                }}
              />
            </div>
            <Button onClick={adicionar} disabled={!novoNome.trim() || createParque.isPending}>
              <PlusIcon data-icon="inline-start" />
              {createParque.isPending ? "Adicionando…" : "Adicionar"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2.5">
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-48" />
              </CardContent>
            </Card>
          ))}

        {!isLoading && parques.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <MapPinIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhum parque cadastrado ainda</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {parques.map((p) => (
          <ParqueRow key={p.id} parque={p} podeEditar={podeEditar} />
        ))}
      </div>
    </>
  );
}

function ParqueRow({
  parque,
  podeEditar,
}: {
  parque: Parque;
  podeEditar: boolean;
}) {
  const updateParque = useUpdateParque();
  const [nome, setNome] = useState(parque.nome);
  const alterado = nome.trim() !== parque.nome && nome.trim().length > 0;

  return (
    <Card className={cn(!parque.ativo && "opacity-60")}>
      <CardContent className="flex items-center gap-3 p-4">
        <MapPinIcon className="size-4 shrink-0 text-muted-foreground" />
        {podeEditar ? (
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="max-w-sm"
          />
        ) : (
          <span className="font-medium">{parque.nome}</span>
        )}
        <Badge
          className={cn(
            "ml-auto border-transparent",
            parque.ativo
              ? "bg-success/15 text-success"
              : "bg-muted text-muted-foreground"
          )}
        >
          {parque.ativo ? "Ativo" : "Inativo"}
        </Badge>

        {podeEditar && (
          <div className="flex gap-2">
            {alterado && (
              <Button
                size="sm"
                disabled={updateParque.isPending}
                onClick={() =>
                  updateParque.mutate({ id: parque.id, data: { nome: nome.trim() } })
                }
              >
                <CheckIcon data-icon="inline-start" />
                Salvar
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={updateParque.isPending}
              onClick={() =>
                updateParque.mutate({
                  id: parque.id,
                  data: { ativo: !parque.ativo },
                })
              }
            >
              {parque.ativo ? "Desativar" : "Ativar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
