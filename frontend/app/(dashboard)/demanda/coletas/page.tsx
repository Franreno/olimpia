"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ClipboardPlusIcon,
  MapPinIcon,
  TriangleAlertIcon,
  CheckCircle2Icon,
} from "lucide-react";
import {
  useRespostas,
  useParques,
  useFormularioAtivo,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ColetasPage() {
  const { user } = useAuth();
  const ano = new Date().getFullYear();
  const { data: parques = [] } = useParques();
  const { data: formulario } = useFormularioAtivo();
  const { data: respostas = [], isLoading } = useRespostas(undefined, ano);

  const isPesquisador = user?.perfil === "pesquisador";

  // Researchers see only their own coletas; coordinators/admins see everything.
  const minhas = useMemo(() => {
    const list = isPesquisador
      ? respostas.filter((r) => r.pesquisador_id === user?.id)
      : respostas;
    return [...list].sort(
      (a, b) =>
        new Date(b.coletado_em).getTime() - new Date(a.coletado_em).getTime()
    );
  }, [respostas, isPesquisador, user?.id]);

  const parkName = useMemo(() => {
    const map = new Map(parques.map((p) => [p.slug, p.nome]));
    return (slug: string) => map.get(slug) ?? slug;
  }, [parques]);

  const recentes = minhas.slice(0, 8);
  const totalLabel = isPesquisador
    ? "suas coletas em " + ano
    : "coletas em " + ano;

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Coletas de campo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre uma nova pesquisa de demanda ou acompanhe as coletas recentes.
        </p>
      </div>

      {/* Primary action — the researcher's whole job */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ClipboardPlusIcon className="size-6" />
            </div>
            <div>
              <p className="text-base font-semibold">Nova pesquisa de campo</p>
              <p className="text-sm text-muted-foreground">
                {formulario
                  ? `Versão ${formulario.ano} · ${formulario.schema_json.campos?.length ?? 0} perguntas`
                  : "Registre uma nova coleta de demanda"}
              </p>
            </div>
          </div>
          <Button
            size="lg"
            render={<Link href="/demanda/formulario" />}
            nativeButton={false}
            className="w-full shrink-0 sm:w-auto"
          >
            <ClipboardPlusIcon data-icon="inline-start" />
            Iniciar coleta
          </Button>
        </CardContent>
      </Card>

      {/* Recent collections */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            {isPesquisador ? "Minhas coletas recentes" : "Coletas recentes"}
          </h2>
          {!isLoading && (
            <span className="text-xs text-muted-foreground">
              {minhas.length} {totalLabel}
            </span>
          )}
        </div>
        {!isLoading && recentes.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            <span className="font-medium text-warning">Alerta</span> indica uma
            inconsistência de coerência detectada na resposta (ex.: gasto
            incompatível com a renda). <span className="font-medium text-success">OK</span>{" "}
            indica resposta sem inconsistências.
          </p>
        )}

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentes.length === 0 ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardPlusIcon />
              </EmptyMedia>
              <EmptyTitle>Nenhuma coleta ainda</EmptyTitle>
              <EmptyDescription>
                Toque em “Iniciar coleta” para registrar a primeira pesquisa.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {recentes.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <MapPinIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {parkName(r.parque)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(r.coletado_em)}
                      </p>
                    </div>
                  </div>
                  {r.alerta_coerencia ? (
                    <Badge className="shrink-0 border-transparent bg-warning/15 text-warning">
                      <TriangleAlertIcon className="size-3" />
                      Alerta
                    </Badge>
                  ) : (
                    <Badge className="shrink-0 border-transparent bg-success/15 text-success">
                      <CheckCircle2Icon className="size-3" />
                      OK
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
