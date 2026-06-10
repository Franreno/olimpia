"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftIcon, PencilIcon, TrashIcon, InfoIcon } from "lucide-react";
import { useEmpresa, useAuditLog, useSoftDeleteEmpresa, useCategorias } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { AuditLog } from "@/lib/types";

const TABS = [
  { id: "info", label: "Informações" },
  { id: "hospedagem", label: "Dados de Hospedagem" },
  { id: "audit", label: "Histórico de alterações" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

const AUDIT_FIELD_LABELS: Record<string, string> = {
  nome_fantasia: "Nome fantasia",
  razao_social: "Razão social",
  cnpj: "CNPJ",
  endereco: "Endereço",
  bairro: "Bairro",
  telefone: "Telefone",
  email: "E-mail",
  status: "Status",
  data_baixa: "Data de baixa",
  aceita_pesquisas: "Aceita pesquisas",
  contato_pesquisas: "Responsável pelas pesquisas",
  telefone_pesquisas: "Telefone para pesquisas",
  email_pesquisas: "E-mail para pesquisas",
  proprietario: "Proprietário",
  uhs: "Número de UHs",
  leitos: "Número de leitos",
  tipo: "Tipo",
  capacidade: "Capacidade",
  tipo_culinaria: "Tipo de culinária",
  capacidade_pessoas: "Capacidade (pessoas)",
  subcategoria: "Subcategoria",
};

const AUDIT_PAGE_SIZE = 8;

function auditFieldLabel(field?: string | null): string {
  if (!field) return "campo";
  return AUDIT_FIELD_LABELS[field] ?? field;
}

function isEmptyAuditValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value === "object") {
    return Array.isArray(value)
      ? value.length === 0
      : Object.keys(value as object).length === 0;
  }
  return false;
}

function formatAuditValue(field: string | undefined, value: unknown): string {
  if (isEmptyAuditValue(value)) return "—";
  if (field === "status") {
    if (value === "ativo") return "Ativo";
    if (value === "inativo") return "Inativo";
    return String(value);
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (field === "data_baixa" && typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  return String(value);
}

function auditInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Older audit rows (before per-key campos_extras diffing) logged the whole
// dict as one row — diff it client-side so it renders like the newer rows.
function isLegacyCamposExtrasRow(log: AuditLog): boolean {
  return (
    log.operacao === "UPDATE" &&
    log.campo_alterado === "campos_extras" &&
    isPlainObject(log.valor_anterior) &&
    isPlainObject(log.valor_novo)
  );
}

function camposExtrasDiff(
  oldVal: unknown,
  newVal: unknown
): { key: string; oldV: unknown; newV: unknown }[] {
  const oldObj = isPlainObject(oldVal) ? oldVal : {};
  const newObj = isPlainObject(newVal) ? newVal : {};
  const diffs: { key: string; oldV: unknown; newV: unknown }[] = [];
  for (const key of new Set([...Object.keys(oldObj), ...Object.keys(newObj)])) {
    const oldV = oldObj[key];
    const newV = newObj[key];
    const normOld = isEmptyAuditValue(oldV) ? null : oldV;
    const normNew = isEmptyAuditValue(newV) ? null : newV;
    if (normOld === normNew) continue;
    diffs.push({ key, oldV, newV });
  }
  return diffs;
}

function AuditEntry({ entry, isLast }: { entry: AuditLog; isLast: boolean }) {
  const when = new Date(entry.criado_em).toLocaleString("pt-BR");
  const isInsert = entry.operacao === "INSERT";

  return (
    <div className="flex gap-3 relative">
      {!isLast && (
        <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border" />
      )}
      <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0 z-10">
        {auditInitials(entry.usuario_nome)}
      </div>
      <div className="flex-1 pt-0.5 pb-5">
        <div className="flex items-center gap-2 mb-1">
          {entry.usuario_nome && (
            <span className="text-sm font-medium">{entry.usuario_nome}</span>
          )}
          <span className="text-xs text-muted-foreground">{when}</span>
        </div>
        {isInsert ? (
          <p className="text-sm">
            <Badge className="bg-success/15 text-success border-transparent">
              Criou o estabelecimento
            </Badge>
          </p>
        ) : isLegacyCamposExtrasRow(entry) ? (
          <div className="flex flex-col gap-1">
            {camposExtrasDiff(entry.valor_anterior, entry.valor_novo).map(
              ({ key, oldV, newV }) => (
                <p key={key} className="text-sm text-foreground">
                  Alterou{" "}
                  <strong className="font-medium">{auditFieldLabel(key)}</strong>:{" "}
                  <span className="rounded px-1.5 py-0.5 bg-warning/10 text-warning text-xs">
                    {formatAuditValue(key, oldV)}
                  </span>{" "}
                  →{" "}
                  <span className="rounded px-1.5 py-0.5 bg-success/10 text-success text-xs">
                    {formatAuditValue(key, newV)}
                  </span>
                </p>
              )
            )}
          </div>
        ) : (
          <p className="text-sm text-foreground">
            Alterou{" "}
            <strong className="font-medium">{auditFieldLabel(entry.campo_alterado)}</strong>:{" "}
            <span className="rounded px-1.5 py-0.5 bg-warning/10 text-warning text-xs">
              {formatAuditValue(entry.campo_alterado, entry.valor_anterior)}
            </span>{" "}
            →{" "}
            <span className="rounded px-1.5 py-0.5 bg-success/10 text-success text-xs">
              {formatAuditValue(entry.campo_alterado, entry.valor_novo)}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function EmpresaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [auditLimit, setAuditLimit] = useState(AUDIT_PAGE_SIZE);

  const { data: empresa, isLoading: loadingEmpresa } = useEmpresa(id);
  const { data: auditLogs = [], isLoading: loadingAudit } = useAuditLog(id);
  const visibleAuditLogs = auditLogs.filter((log) => {
    if (log.operacao !== "UPDATE") return true;
    if (isLegacyCamposExtrasRow(log)) {
      return camposExtrasDiff(log.valor_anterior, log.valor_novo).length > 0;
    }
    return !(isEmptyAuditValue(log.valor_anterior) && isEmptyAuditValue(log.valor_novo));
  });
  const { data: categorias = [] } = useCategorias();
  const softDelete = useSoftDeleteEmpresa();

  const categoria = categorias.find((c) => c.id === empresa?.categoria_id);
  const extras = empresa?.campos_extras as Record<string, unknown> | undefined;

  async function handleDelete() {
    await softDelete.mutateAsync(id);
    router.push("/inventario");
  }

  if (loadingEmpresa) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!empresa) {
    return (
      <Alert variant="destructive">Estabelecimento não encontrado.</Alert>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/inventario" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Voltar ao inventário
        </Button>
        <div className="flex gap-2">
          {empresa.status === "ativo" && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  />
                }
              >
                <TrashIcon data-icon="inline-start" />
                Inativar
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Inativar estabelecimento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O estabelecimento será marcado como inativo. Esta ação é
                    registrada no audit log e pode ser revertida.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Inativar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button
            size="sm"
            render={<Link href={`/inventario/${id}/editar`} />}
            nativeButton={false}
          >
            <PencilIcon data-icon="inline-start" />
            Editar
          </Button>
        </div>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-xl font-bold">{empresa.nome_fantasia}</h1>
                <Badge
                  variant="secondary"
                  className={
                    empresa.status === "ativo"
                      ? "bg-success/15 text-success border-transparent hover:bg-success/20"
                      : "bg-muted text-muted-foreground border-transparent"
                  }
                >
                  {empresa.status === "ativo" ? "● Ativo" : "● Inativo"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {categoria && <span>{categoria.nome}</span>}
                {extras?.tipo != null && (
                  <>
                    <span className="text-border">·</span>
                    <span>{String(extras.tipo)}</span>
                  </>
                )}
                {empresa.atualizado_em && (
                  <>
                    <span className="text-border">·</span>
                    <span>
                      Atualizado em{" "}
                      {new Date(empresa.atualizado_em).toLocaleDateString(
                        "pt-BR"
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              "px-4 py-2.5 text-sm border-b-2 transition-colors " +
              (activeTab === tab.id
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Dados gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <FieldRow label="Razão social" value={empresa.razao_social} />
              <FieldRow label="CNPJ" value={empresa.cnpj} />
              <FieldRow label="Endereço" value={empresa.endereco} />
              <FieldRow label="Bairro" value={empresa.bairro} />
              <FieldRow label="Telefone" value={empresa.telefone} />
              <FieldRow label="E-mail" value={empresa.email} />
              <FieldRow label="Proprietário" value={empresa.proprietario} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                Contato para pesquisas
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <FieldRow
                label="Aceita pesquisas"
                value={empresa.aceita_pesquisas ? "Sim" : "Não"}
              />
              <FieldRow
                label="Responsável"
                value={empresa.contato_pesquisas}
              />
              <FieldRow
                label="Telefone"
                value={empresa.telefone_pesquisas}
              />
              <FieldRow label="E-mail" value={empresa.email_pesquisas} />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "hospedagem" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Unidades Habitacionais (UHs)",
                key: "uhs",
                sub: "Quartos / apartamentos",
                color: "text-primary",
              },
              {
                label: "Número de leitos",
                key: "leitos",
                sub: "Capacidade total de hóspedes",
                color: "text-[oklch(0.54_0.10_210)]",
              },
              {
                label: "Tipo de hospedagem",
                key: "tipo",
                sub: "hotel, resort, flat ou pousada",
                color: "text-success",
              },
            ].map((s) => (
              <Card key={s.key}>
                <CardContent className="pt-5">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">
                    {s.label}
                  </p>
                  <p className={`text-4xl font-bold leading-none ${s.color}`}>
                    {extras ? String(extras[s.key] ?? "—") : "—"}
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {s.sub}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Histórico de alterações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingAudit ? (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : visibleAuditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sem registros de alteração.
              </p>
            ) : (
              <>
                <div>
                  {visibleAuditLogs.slice(0, auditLimit).map((log, i, arr) => (
                    <AuditEntry
                      key={log.id}
                      entry={log}
                      isLast={i === arr.length - 1}
                    />
                  ))}
                </div>
                {visibleAuditLogs.length > auditLimit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-1"
                    onClick={() => setAuditLimit((n) => n + AUDIT_PAGE_SIZE)}
                  >
                    Mostrar mais
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
