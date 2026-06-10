"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { z } from "zod";
import { useCategorias, useCreateEmpresa } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const HOSPEDAGEM_SLUG = "meios_hospedagem";
const HOSPEDAGEM_TIPOS = ["Hotel", "Resort", "Flat", "Pousada", "Outro"];

const schema = z.object({
  categoria_id: z.number({ message: "Selecione uma categoria" }),
  nome_fantasia: z.string().min(1, "Nome é obrigatório"),
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  proprietario: z.string().optional(),
  contato_pesquisas: z.string().optional(),
  telefone_pesquisas: z.string().optional(),
  email_pesquisas: z.string().email("E-mail inválido").optional().or(z.literal("")),
  campos_extras: z.record(z.string(), z.unknown()).optional(),
});

type FormValues = z.infer<typeof schema>;

function FieldGroup({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}

export default function NovoEstabelecimentoPage() {
  const router = useRouter();
  const { data: categorias = [] } = useCategorias();
  const createEmpresa = useCreateEmpresa();

  const [values, setValues] = useState<Partial<FormValues>>({
    campos_extras: {},
  });
  const [tipo, setTipo] = useState<string>("");
  const [uhs, setUhs] = useState("");
  const [leitos, setLeitos] = useState("");
  const [aceitaPesquisas, setAceitaPesquisas] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedCat = categorias.find((c) => c.id === values.categoria_id);
  const isHospedagem = selectedCat?.slug === HOSPEDAGEM_SLUG;

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const parsed = schema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((err) => {
        if (err.path[0]) errs[String(err.path[0])] = err.message;
      });
      setErrors(errs);
      return;
    }

    const campos_extras: Record<string, unknown> = {};
    if (isHospedagem) {
      if (tipo) campos_extras.tipo = tipo;
      if (uhs) campos_extras.uhs = parseInt(uhs);
      if (leitos) campos_extras.leitos = parseInt(leitos);
    }

    try {
      const created = await createEmpresa.mutateAsync({
        ...parsed.data,
        email: parsed.data.email || undefined,
        email_pesquisas: parsed.data.email_pesquisas || undefined,
        aceita_pesquisas: aceitaPesquisas,
        campos_extras,
      });
      router.push(`/inventario/${created.id}`);
    } catch {
      setSubmitError(
        "Erro ao salvar estabelecimento. Verifique os dados e tente novamente."
      );
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-3xl">
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
          <Button
            variant="ghost"
            render={<Link href="/inventario" />}
            nativeButton={false}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={createEmpresa.isPending}>
            <CheckIcon data-icon="inline-start" />
            {createEmpresa.isPending ? "Salvando…" : "Salvar estabelecimento"}
          </Button>
        </div>
      </div>

      <h1 className="text-xl font-bold">Novo estabelecimento</h1>

      {submitError && (
        <Alert variant="destructive">{submitError}</Alert>
      )}

      {/* Identificação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup label="Nome do estabelecimento" required className="col-span-2">
            <Input
              placeholder="Nome fantasia"
              value={values.nome_fantasia ?? ""}
              onChange={(e) => set("nome_fantasia", e.target.value)}
              aria-invalid={!!errors.nome_fantasia}
            />
            {errors.nome_fantasia && (
              <p className="text-xs text-destructive">{errors.nome_fantasia}</p>
            )}
          </FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Razão social">
              <Input
                placeholder="Razão social (CNPJ)"
                value={values.razao_social ?? ""}
                onChange={(e) => set("razao_social", e.target.value)}
              />
            </FieldGroup>
            <FieldGroup label="CNPJ">
              <Input
                placeholder="00.000.000/0001-00"
                value={values.cnpj ?? ""}
                onChange={(e) => set("cnpj", e.target.value)}
              />
            </FieldGroup>
            <FieldGroup label="Telefone">
              <Input
                placeholder="(17) 00000-0000"
                value={values.telefone ?? ""}
                onChange={(e) => set("telefone", e.target.value)}
              />
            </FieldGroup>
            <FieldGroup label="E-mail de contato">
              <Input
                type="email"
                placeholder="contato@estabelecimento.com"
                value={values.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </FieldGroup>
          </div>
          <FieldGroup label="Endereço">
            <Input
              placeholder="Rua, número — Olímpia/SP"
              value={values.endereco ?? ""}
              onChange={(e) => set("endereco", e.target.value)}
            />
          </FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Bairro">
              <Input
                placeholder="Bairro"
                value={values.bairro ?? ""}
                onChange={(e) => set("bairro", e.target.value)}
              />
            </FieldGroup>
            <FieldGroup label="Proprietário">
              <Input
                placeholder="Nome do proprietário"
                value={values.proprietario ?? ""}
                onChange={(e) => set("proprietario", e.target.value)}
              />
            </FieldGroup>
          </div>
        </CardContent>
      </Card>

      {/* Classificação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Classificação
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup label="Categoria" required>
            <div className="flex flex-wrap gap-2">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => set("categoria_id", cat.id)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-all",
                    values.categoria_id === cat.id
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {cat.nome}
                </button>
              ))}
            </div>
            {errors.categoria_id && (
              <p className="text-xs text-destructive">{errors.categoria_id}</p>
            )}
          </FieldGroup>

          {isHospedagem && (
            <FieldGroup label="Tipo de meio de hospedagem">
              <div className="flex flex-wrap gap-2">
                {HOSPEDAGEM_TIPOS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(tipo === t ? "" : t)}
                    className={cn(
                      "rounded-full border px-4 py-1.5 text-sm transition-all",
                      tipo === t
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </FieldGroup>
          )}
        </CardContent>
      </Card>

      {/* Dados de Hospedagem (conditional) */}
      {isHospedagem && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
              Dados de hospedagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <FieldGroup label="Unidades Habitacionais (UHs)" required>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={uhs}
                  onChange={(e) => setUhs(e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Número de leitos" required>
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={leitos}
                  onChange={(e) => setLeitos(e.target.value)}
                />
              </FieldGroup>
              <FieldGroup label="Peso calculado">
                <Input
                  disabled
                  value="Calculado automaticamente"
                  className="bg-muted text-muted-foreground"
                />
              </FieldGroup>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contato para pesquisas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            Contato para pesquisas
          </CardTitle>
          <CardDescription>
            Usado para convidar o estabelecimento a participar das pesquisas
            de ocupação e demanda.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FieldGroup label="Aceita participar de pesquisas">
            <div className="flex gap-2">
              {[
                { label: "Sim", value: true },
                { label: "Não", value: false },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setAceitaPesquisas(opt.value)}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm transition-all",
                    aceitaPesquisas === opt.value
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Responsável">
              <Input
                placeholder="Nome do responsável"
                value={values.contato_pesquisas ?? ""}
                onChange={(e) => set("contato_pesquisas", e.target.value)}
              />
            </FieldGroup>
            <FieldGroup label="Telefone">
              <Input
                placeholder="(17) 00000-0000"
                value={values.telefone_pesquisas ?? ""}
                onChange={(e) => set("telefone_pesquisas", e.target.value)}
              />
            </FieldGroup>
            <FieldGroup label="E-mail" className="col-span-2">
              <Input
                type="email"
                placeholder="pesquisas@estabelecimento.com"
                value={values.email_pesquisas ?? ""}
                onChange={(e) => set("email_pesquisas", e.target.value)}
                aria-invalid={!!errors.email_pesquisas}
              />
              {errors.email_pesquisas && (
                <p className="text-xs text-destructive">{errors.email_pesquisas}</p>
              )}
            </FieldGroup>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
