"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// ── Category-specific extra fields (campos_extras), per CLAUDE.md §5 schema ─────

export type ExtraFieldKind = "text" | "number" | "select";

export interface ExtraFieldDef {
  key: string;
  label: string;
  kind: ExtraFieldKind;
  options?: string[];
  required?: boolean;
  /** Helper line shown under the value in the read-only detail view. */
  sub?: string;
}

export interface CategoryFieldConfig {
  /** Card title on the create/edit forms, e.g. "Dados de hospedagem". */
  sectionLabel: string;
  /** Tab label on the detail page, e.g. "Dados de Hospedagem". */
  tabLabel: string;
  /** Form grid columns (default 2). */
  columns?: number;
  fields: ExtraFieldDef[];
  /** Optional read-only note rendered after the inputs (e.g. computed weight). */
  trailingNote?: { label: string; value: string };
}

export const CATEGORY_FIELDS: Record<string, CategoryFieldConfig> = {
  meios_hospedagem: {
    sectionLabel: "Dados de hospedagem",
    tabLabel: "Dados de Hospedagem",
    columns: 3,
    fields: [
      {
        key: "tipo",
        label: "Tipo de meio de hospedagem",
        kind: "select",
        options: ["Hotel", "Resort", "Flat", "Pousada", "Outro"],
        sub: "hotel, resort, flat ou pousada",
      },
      { key: "uhs", label: "Unidades Habitacionais (UHs)", kind: "number", required: true, sub: "Quartos / apartamentos" },
      { key: "leitos", label: "Número de leitos", kind: "number", required: true, sub: "Capacidade total de hóspedes" },
    ],
    trailingNote: {
      label: "Peso na taxa de ocupação",
      value: "Derivado dos leitos ao salvar",
    },
  },
  alimentacao: {
    sectionLabel: "Dados de alimentação",
    tabLabel: "Dados de Alimentação",
    columns: 2,
    fields: [
      { key: "capacidade", label: "Capacidade (lugares)", kind: "number", sub: "Lugares disponíveis" },
      { key: "tipo_culinaria", label: "Tipo de culinária", kind: "text", sub: "Ex.: regional, italiana, japonesa" },
    ],
  },
  atrativos: {
    sectionLabel: "Dados do atrativo",
    tabLabel: "Dados do Atrativo",
    columns: 2,
    fields: [
      { key: "tipo", label: "Tipo de atrativo", kind: "text", sub: "Ex.: parque aquático, natural, cultural" },
    ],
  },
  agencias: {
    sectionLabel: "Dados da agência",
    tabLabel: "Dados da Agência",
    columns: 2,
    fields: [
      { key: "tipo", label: "Tipo", kind: "select", options: ["Agência", "Operadora"], sub: "agência ou operadora" },
    ],
  },
  eventos: {
    sectionLabel: "Dados do espaço de eventos",
    tabLabel: "Dados de Eventos",
    columns: 2,
    fields: [
      { key: "capacidade_pessoas", label: "Capacidade (pessoas)", kind: "number", sub: "Público máximo" },
    ],
  },
  servicos_apoio: {
    sectionLabel: "Dados do serviço de apoio",
    tabLabel: "Dados do Serviço",
    columns: 2,
    fields: [
      {
        key: "subcategoria",
        label: "Subcategoria",
        kind: "select",
        options: ["Farmácia", "Supermercado", "Posto", "Banco", "Clínica"],
        sub: "tipo de serviço de apoio",
      },
    ],
  },
  // transporte: no category-specific fields in the schema
};

export function hasCategoryData(slug?: string): boolean {
  return !!(slug && CATEGORY_FIELDS[slug]);
}

export function categoryConfig(slug?: string): CategoryFieldConfig | undefined {
  return slug ? CATEGORY_FIELDS[slug] : undefined;
}

/** Build the `campos_extras` payload from string form values (numbers parsed). */
export function serializeExtras(
  slug: string | undefined,
  extras: Record<string, string>
): Record<string, unknown> {
  const config = categoryConfig(slug);
  const out: Record<string, unknown> = {};
  if (!config) return out;
  for (const f of config.fields) {
    const raw = extras[f.key];
    if (raw == null || raw === "") continue;
    out[f.key] = f.kind === "number" ? parseInt(raw, 10) : raw;
  }
  return out;
}

/** Seed the string form state from a stored `campos_extras` object. */
export function extrasToForm(
  slug: string | undefined,
  campos: Record<string, unknown> | null | undefined
): Record<string, string> {
  const config = categoryConfig(slug);
  const out: Record<string, string> = {};
  if (!config || !campos) return out;
  for (const f of config.fields) {
    const v = campos[f.key];
    if (v != null) out[f.key] = String(v);
  }
  return out;
}

function FieldGroup({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

const colClass: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
};

/** Editable category-specific fields for the create/edit forms. */
export function EmpresaFormFields({
  slug,
  extras,
  onChange,
}: {
  slug?: string;
  extras: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const config = categoryConfig(slug);
  if (!config) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {config.sectionLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid grid-cols-1 gap-4", colClass[config.columns ?? 2])}>
          {config.fields.map((f) => (
            <FieldGroup key={f.key} label={f.label} required={f.required}>
              {f.kind === "select" ? (
                <ToggleGroup
                  value={extras[f.key] ? [extras[f.key]] : []}
                  onValueChange={(v: string[]) => onChange(f.key, v[0] ?? "")}
                  variant="outline"
                  className="flex flex-wrap"
                >
                  {f.options?.map((opt) => (
                    <ToggleGroupItem key={opt} value={opt}>
                      {opt}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              ) : (
                <Input
                  type={f.kind === "number" ? "number" : "text"}
                  min={f.kind === "number" ? "0" : undefined}
                  placeholder={f.kind === "number" ? "0" : f.label}
                  value={extras[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              )}
            </FieldGroup>
          ))}
          {config.trailingNote && (
            <FieldGroup label={config.trailingNote.label}>
              <Input
                disabled
                value={config.trailingNote.value}
                className="bg-muted text-muted-foreground"
              />
            </FieldGroup>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/** Read-only category data cards for the detail page. */
export function EmpresaCategoryData({
  slug,
  campos,
}: {
  slug?: string;
  campos?: Record<string, unknown>;
}) {
  const config = categoryConfig(slug);
  if (!config) return null;

  return (
    <div className={cn("grid grid-cols-1 gap-4", colClass[config.columns ?? 2])}>
      {config.fields.map((f) => (
        <Card key={f.key}>
          <CardContent className="pt-5">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{f.label}</p>
            <p className={cn("text-4xl font-bold leading-none", f.kind === "number" ? "text-primary" : "text-success")}>
              {campos && campos[f.key] != null ? String(campos[f.key]) : "—"}
            </p>
            {f.sub && <p className="mt-2 text-xs text-muted-foreground/60">{f.sub}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
