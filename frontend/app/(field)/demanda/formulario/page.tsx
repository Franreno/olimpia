"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, TriangleAlertIcon, ListChecksIcon } from "lucide-react";
import {
  useCidades,
  useFormularioAtivo,
  useCreateResposta,
  useParques,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { Cidade } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

const INCOME_RANGES = [
  "Até R$ 2.000",
  "R$ 2.001 – R$ 4.000",
  "R$ 4.001 – R$ 8.000",
  "R$ 8.001 – R$ 15.000",
  "Acima de R$ 15.000",
  "Prefiro não informar",
];

const RENDA_MAX: Record<string, number> = {
  "Até R$ 2.000": 2000,
  "R$ 2.001 – R$ 4.000": 4000,
  "R$ 4.001 – R$ 8.000": 8000,
  "R$ 8.001 – R$ 15.000": 15000,
  "Acima de R$ 15.000": 25000,
};

const MOTIVATIONS = [
  "Parques aquáticos",
  "Turismo de lazer",
  "Visita a familiares",
  "Lua de mel / Aniversário",
  "Turismo de saúde",
  "Eventos",
  "Outro",
];

export default function FieldFormPage() {
  const { user } = useAuth();
  const { data: formulario } = useFormularioAtivo();
  const { data: parques = [] } = useParques(true);
  const createResposta = useCreateResposta();

  const [selectedPark, setSelectedPark] = useState<string | null>(null);
  const [cityQuery, setCityQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<Cidade | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [nights, setNights] = useState("");
  const [spending, setSpending] = useState("");
  const [income, setIncome] = useState("");
  const [motivations, setMotivations] = useState<string[]>([]);
  const [nps, setNps] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: citySuggestions = [] } = useCidades(cityQuery);

  // derive the active park: explicit selection, else the first active park
  const park = selectedPark ?? parques[0]?.slug ?? "";
  const setPark = setSelectedPark;

  const fator =
    formulario?.schema_json.regras_coerencia?.find(
      (r) => r.tipo === "gasto_vs_renda"
    )?.fator ?? 0.5;
  const rendaMax = income ? RENDA_MAX[income] : undefined;
  const gasto = spending ? parseFloat(spending) : undefined;
  const showCoherenceWarning =
    rendaMax !== undefined && gasto !== undefined && gasto > rendaMax * fator;

  const canSubmit =
    !!park && !!selectedCity && nights !== "" && spending !== "" && nps !== null;

  async function handleSubmit() {
    setError(null);
    try {
      await createResposta.mutateAsync({
        parque: park,
        coletado_em: new Date().toISOString(),
        estadia: {
          cidade_residencia: selectedCity?.nome,
          estado_residencia: selectedCity?.uf,
          pernoites: nights ? parseInt(nights) : undefined,
        },
        perfil: {
          renda_familiar: income || undefined,
          gasto_medio_diario: spending || undefined,
        },
        satisfacao: { nps_recomendacao: nps ?? undefined },
        viagem: motivations.length ? { motivo_viagem: motivations } : undefined,
      });
      setSubmitted(true);
    } catch {
      setError("Erro ao registrar a resposta. Verifique a conexão e tente novamente.");
    }
  }

  function resetForm() {
    setSelectedCity(null);
    setCityQuery("");
    setNights("");
    setSpending("");
    setIncome("");
    setMotivations([]);
    setNps(null);
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" className="bg-success/15 text-success">
              <CheckIcon />
            </EmptyMedia>
            <EmptyTitle>Formulário enviado!</EmptyTitle>
            <EmptyDescription>
              Os dados foram registrados com sucesso.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={resetForm}>Nova coleta</Button>
            <Button
              variant="outline"
              render={<Link href="/demanda/coletas" />}
              nativeButton={false}
            >
              Ver coletas
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <div className="flex items-center justify-between bg-primary px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md bg-white/15">
            <span className="text-[11px] font-bold text-white">OTO</span>
          </div>
          <span className="text-sm font-semibold text-white">
            Pesquisa de Demanda Turística
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/demanda/coletas"
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white"
          >
            <ListChecksIcon className="size-4" />
            Coletas
          </Link>
          <span className="text-[13px] text-white/70">
            {new Date().toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {error && (
          <Alert variant="destructive" className="mb-5">
            <TriangleAlertIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Coherence warning */}
        {showCoherenceWarning && (
          <Alert variant="warning" className="mb-5">
            <TriangleAlertIcon />
            <AlertTitle>Atenção: inconsistência detectada</AlertTitle>
            <AlertDescription>
              O gasto diário declarado parece incompatível com a faixa de renda
              informada. Por favor, verifique os valores com o entrevistado.
            </AlertDescription>
          </Alert>
        )}

        {/* Park selector (dynamic) */}
        <Field label="Local da pesquisa" required>
          {parques.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>Nenhum parque cadastrado</EmptyTitle>
                <EmptyDescription>
                  Cadastre um parque em Demanda → Parques.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <ToggleGroup
              value={park ? [park] : []}
              onValueChange={(v: string[]) => v[0] && setPark(v[0])}
              variant="outline"
              size="lg"
              className="grid w-full grid-cols-2 gap-2.5"
            >
              {parques.map((p) => (
                <ToggleGroupItem key={p.slug} value={p.slug} className="h-12">
                  {p.nome}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </Field>

        {/* Researcher — current logged-in user (read-only) */}
        <Field label="Pesquisador(a)" required>
          <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{user?.nome ?? "—"}</span>
            {formulario && (
              <span className="text-xs text-muted-foreground">
                Formulário {formulario.ano}
              </span>
            )}
          </div>
        </Field>

        {/* Origin city — IBGE autocomplete */}
        <Field label="Cidade de origem" required>
          <div className="relative">
            <Input
              value={selectedCity ? `${selectedCity.nome} — ${selectedCity.uf}` : cityQuery}
              onChange={(e) => {
                setSelectedCity(null);
                setCityQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Digite a cidade..."
            />
            {showSuggestions && !selectedCity && citySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md">
                {citySuggestions.map((c) => (
                  <button
                    key={`${c.nome}-${c.uf}`}
                    type="button"
                    onClick={() => {
                      setSelectedCity(c);
                      setShowSuggestions(false);
                    }}
                    className="block w-full border-b px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/50"
                  >
                    {c.nome} — {c.uf}
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Base IBGE de municípios brasileiros
          </p>
        </Field>

        {/* Nights + spending */}
        <div className="grid grid-cols-2 gap-3.5">
          <Field label="Pernoites" required>
            <Input
              type="number"
              min="0"
              max="30"
              value={nights}
              onChange={(e) => setNights(e.target.value)}
              placeholder="0"
            />
          </Field>
          <Field label="Gasto diário (R$)" required>
            <Input
              type="number"
              min="0"
              value={spending}
              onChange={(e) => setSpending(e.target.value)}
              placeholder="0,00"
              aria-invalid={showCoherenceWarning}
            />
          </Field>
        </div>

        {/* Income */}
        <Field label="Renda familiar mensal">
          <ToggleGroup
            value={income ? [income] : []}
            onValueChange={(v: string[]) => setIncome(v[0] ?? "")}
            variant="outline"
            className="grid w-full grid-cols-2 gap-2"
          >
            {INCOME_RANGES.map((r) => (
              <ToggleGroupItem key={r} value={r} className="justify-start">
                {r}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {/* Motivations */}
        <Field label="Motivação da viagem">
          <span className="mb-2 block text-xs text-muted-foreground">
            (múltipla escolha)
          </span>
          <ToggleGroup
            multiple
            value={motivations}
            onValueChange={(v: string[]) => setMotivations(v)}
            variant="outline"
            className="flex flex-wrap"
          >
            {MOTIVATIONS.map((m) => (
              <ToggleGroupItem key={m} value={m}>
                {m}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {/* NPS — color-coded 0–10 rating scale (intentionally custom: 11 options,
            detractor/passive/promoter color semantics) */}
        <Field label="NPS — Recomendação" required>
          <p className="mb-3 text-sm text-muted-foreground">
            Em uma escala de 0 a 10, qual a probabilidade de você recomendar
            Olímpia como destino turístico?
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: 11 }, (_, n) => n).map((n) => {
              const selected = nps === n;
              const color =
                n >= 9
                  ? "bg-success border-success"
                  : n >= 7
                    ? "bg-warning border-warning"
                    : "bg-danger border-danger";
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNps(n)}
                  className={cn(
                    "flex aspect-square flex-1 items-center justify-center rounded-lg border-[1.5px] text-sm transition-all",
                    selected
                      ? `${color} font-bold text-white`
                      : "border-border bg-background text-foreground"
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Muito improvável</span>
            <span>Muito provável</span>
          </div>
        </Field>

        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit || createResposta.isPending}
          className="mt-7 w-full"
        >
          {createResposta.isPending ? "Registrando…" : "Registrar resposta"}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <label className="mb-2 block text-sm font-semibold text-foreground/80">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}
