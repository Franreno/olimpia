"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CheckIcon,
  TriangleAlertIcon,
  LayoutDashboardIcon,
} from "lucide-react";
import { useCidades, useFormularioAtivo, useCreateResposta } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import type { Cidade, Parque } from "@/lib/types";
import { PARQUE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

const PARQUES: Parque[] = ["thermas", "rubio"];

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
  const createResposta = useCreateResposta();

  const [park, setPark] = useState<Parque>("thermas");
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

  const fator =
    formulario?.schema_json.regras_coerencia?.find(
      (r) => r.tipo === "gasto_vs_renda"
    )?.fator ?? 0.5;
  const rendaMax = income ? RENDA_MAX[income] : undefined;
  const gasto = spending ? parseFloat(spending) : undefined;
  const showCoherenceWarning =
    rendaMax !== undefined && gasto !== undefined && gasto > rendaMax * fator;

  const canSubmit =
    !!selectedCity && nights !== "" && spending !== "" && nps !== null;

  function toggleMotivation(m: string) {
    setMotivations((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  }

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
      <div className="min-h-screen bg-muted/40 flex items-center justify-center">
        <div className="text-center px-6">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-success/15">
            <CheckIcon className="size-7 text-success" />
          </div>
          <h2 className="text-xl font-bold mb-1.5">Formulário enviado!</h2>
          <p className="text-sm text-muted-foreground mb-7">
            Os dados foram registrados com sucesso.
          </p>
          <button
            onClick={resetForm}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Novo formulário
          </button>
        </div>
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
            href="/demanda"
            className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white"
          >
            <LayoutDashboardIcon className="size-4" />
            Resultados
          </Link>
          <span className="text-[13px] text-white/70">
            {new Date().toLocaleDateString("pt-BR")}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {error && (
          <div className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Coherence warning */}
        {showCoherenceWarning && (
          <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-warning bg-warning/10 px-4 py-3">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-warning">
                Atenção: inconsistência detectada
              </p>
              <p className="text-sm text-muted-foreground">
                O gasto diário declarado parece incompatível com a faixa de renda
                informada. Por favor, verifique os valores com o entrevistado.
              </p>
            </div>
          </div>
        )}

        {/* Park selector */}
        <Field label="Local da pesquisa" required>
          <div className="grid grid-cols-2 gap-2.5">
            {PARQUES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPark(p)}
                className={cn(
                  "rounded-xl border-2 px-3 py-4 text-base font-medium transition-all",
                  park === p
                    ? "border-primary bg-primary/10 font-bold text-primary"
                    : "border-border bg-background text-foreground"
                )}
              >
                {PARQUE_LABELS[p]}
              </button>
            ))}
          </div>
        </Field>

        {/* Researcher — current logged-in user (read-only) */}
        <Field label="Pesquisador(a)" required>
          <div className="flex items-center justify-between rounded-lg border-[1.5px] border-border bg-muted/40 px-3.5 py-3 text-base">
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
            <input
              value={selectedCity ? `${selectedCity.nome} — ${selectedCity.uf}` : cityQuery}
              onChange={(e) => {
                setSelectedCity(null);
                setCityQuery(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Digite a cidade..."
              className="w-full rounded-lg border-[1.5px] border-border bg-background px-3.5 py-3 text-base outline-none focus:border-primary"
            />
            {showSuggestions && !selectedCity && citySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                {citySuggestions.map((c) => (
                  <button
                    key={`${c.nome}-${c.uf}`}
                    type="button"
                    onClick={() => {
                      setSelectedCity(c);
                      setShowSuggestions(false);
                    }}
                    className="block w-full border-b border-muted px-3.5 py-2.5 text-left text-[15px] last:border-0 hover:bg-muted/50"
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
            <input
              type="number"
              min="0"
              max="30"
              value={nights}
              onChange={(e) => setNights(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border-[1.5px] border-border bg-background px-3.5 py-3 text-base outline-none focus:border-primary"
            />
          </Field>
          <Field label="Gasto diário (R$)" required>
            <input
              type="number"
              min="0"
              value={spending}
              onChange={(e) => setSpending(e.target.value)}
              placeholder="0,00"
              className={cn(
                "w-full rounded-lg border-[1.5px] bg-background px-3.5 py-3 text-base outline-none focus:border-primary",
                showCoherenceWarning ? "border-warning" : "border-border"
              )}
            />
          </Field>
        </div>

        {/* Income */}
        <Field label="Renda familiar mensal">
          <div className="grid grid-cols-2 gap-2">
            {INCOME_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setIncome(income === r ? "" : r)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
                  income === r
                    ? "border-2 border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-background text-foreground"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>

        {/* Motivations */}
        <Field label="Motivação da viagem">
          <span className="mb-2 block text-xs text-muted-foreground">
            (múltipla escolha)
          </span>
          <div className="flex flex-wrap gap-2">
            {MOTIVATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMotivation(m)}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-sm transition-all",
                  motivations.includes(m)
                    ? "border-2 border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-background text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>

        {/* NPS */}
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

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || createResposta.isPending}
          className="mt-7 w-full rounded-lg bg-primary py-3.5 text-base font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createResposta.isPending ? "Registrando…" : "Registrar resposta"}
        </button>
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
