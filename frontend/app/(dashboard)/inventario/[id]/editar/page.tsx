"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
import { z } from "zod";
import { useCategorias, useEmpresa, useUpdateEmpresa } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  EmpresaFormFields,
  serializeExtras,
  extrasToForm,
  categoryConfig,
} from "@/components/empresa-form-fields";
import { cn } from "@/lib/utils";

const schema = z.object({
  nome_fantasia: z
    .string({ message: "Nome é obrigatório" })
    .min(1, "Nome é obrigatório"),
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

export default function EditarEstabelecimentoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: empresa, isLoading: loadingEmpresa } = useEmpresa(id);
  const { data: categorias = [] } = useCategorias();
  const updateEmpresa = useUpdateEmpresa(id);

  const [values, setValues] = useState<Partial<FormValues>>({});
  const [aceitaPesquisas, setAceitaPesquisas] = useState(true);
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialized = useRef(false);
  const extrasInit = useRef(false);

  const categoria = categorias.find((c) => c.id === empresa?.categoria_id);

  useEffect(() => {
    if (!empresa || initialized.current) return;
    initialized.current = true;

    setValues({
      nome_fantasia: empresa.nome_fantasia,
      razao_social: empresa.razao_social ?? "",
      cnpj: empresa.cnpj ?? "",
      telefone: empresa.telefone ?? "",
      email: empresa.email ?? "",
      endereco: empresa.endereco ?? "",
      bairro: empresa.bairro ?? "",
      proprietario: empresa.proprietario ?? "",
      contato_pesquisas: empresa.contato_pesquisas ?? "",
      telefone_pesquisas: empresa.telefone_pesquisas ?? "",
      email_pesquisas: empresa.email_pesquisas ?? "",
    });
    setAceitaPesquisas(empresa.aceita_pesquisas);
  }, [empresa]);

  // Category extras depend on the category slug, which may resolve after `empresa`.
  useEffect(() => {
    if (!empresa || !categoria || extrasInit.current) return;
    extrasInit.current = true;
    setExtras(
      extrasToForm(categoria.slug, empresa.campos_extras as Record<string, unknown>)
    );
  }, [empresa, categoria]);

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

    // Preserve any unknown keys, drop this category's old fields (so cleared
    // values are removed), then overlay the edited ones.
    const campos_extras: Record<string, unknown> = {
      ...(empresa?.campos_extras ?? {}),
    };
    for (const f of categoryConfig(categoria?.slug)?.fields ?? []) {
      delete campos_extras[f.key];
    }
    Object.assign(campos_extras, serializeExtras(categoria?.slug, extras));

    try {
      await updateEmpresa.mutateAsync({
        ...parsed.data,
        email: parsed.data.email || undefined,
        email_pesquisas: parsed.data.email_pesquisas || undefined,
        aceita_pesquisas: aceitaPesquisas,
        campos_extras,
      });
      router.push(`/inventario/${id}`);
    } catch {
      setSubmitError(
        "Erro ao salvar alterações. Verifique os dados e tente novamente."
      );
    }
  }

  if (loadingEmpresa) {
    return (
      <div className="flex flex-col gap-4 max-w-3xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!empresa) {
    return <Alert variant="destructive">Estabelecimento não encontrado.</Alert>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/inventario/${id}`} />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Voltar para detalhes
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            render={<Link href={`/inventario/${id}`} />}
            nativeButton={false}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={updateEmpresa.isPending}>
            <CheckIcon data-icon="inline-start" />
            {updateEmpresa.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-xl font-bold">Editar estabelecimento</h1>
        <p className="text-sm text-muted-foreground">{empresa.nome_fantasia}</p>
      </div>

      {submitError && <Alert variant="destructive">{submitError}</Alert>}

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
          <FieldGroup label="Categoria">
            <div>
              {categoria && (
                <Badge variant="secondary">{categoria.nome}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A categoria não pode ser alterada após o cadastro.
            </p>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Category-specific fields (campos_extras) */}
      <EmpresaFormFields
        slug={categoria?.slug}
        extras={extras}
        onChange={(k, v) => setExtras((prev) => ({ ...prev, [k]: v }))}
      />

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
            <ToggleGroup
              value={[aceitaPesquisas ? "sim" : "nao"]}
              onValueChange={(v: string[]) => v[0] && setAceitaPesquisas(v[0] === "sim")}
              variant="outline"
            >
              <ToggleGroupItem value="sim">Sim</ToggleGroupItem>
              <ToggleGroupItem value="nao">Não</ToggleGroupItem>
            </ToggleGroup>
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
