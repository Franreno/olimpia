import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  Empresa,
  EmpresaCreate,
  EmpresaUpdate,
  CategoriaEmpresa,
  AuditLog,
  Cidade,
  FormularioVersao,
  RespostaDemanda,
  RespostaDemandaCreate,
  Indicadores,
  Parque,
  ParqueCreate,
  ParqueUpdate,
} from "./types";

// ── Categorias ───────────────────────────────────────────────────────────────

export function useCategorias() {
  return useQuery<CategoriaEmpresa[]>({
    queryKey: ["categorias"],
    queryFn: () => api.get("/api/v1/categorias").then((r) => r.data),
  });
}

// ── Empresas ─────────────────────────────────────────────────────────────────

interface ListEmpresasParams {
  categoria_id?: number;
  status?: string;
  q?: string;
}

export function useEmpresas(params: ListEmpresasParams = {}) {
  return useQuery<Empresa[]>({
    queryKey: ["empresas", params],
    queryFn: () =>
      api.get("/api/v1/empresas", { params }).then((r) => r.data),
  });
}

export function useEmpresa(id: string) {
  return useQuery<Empresa>({
    queryKey: ["empresas", id],
    queryFn: () => api.get(`/api/v1/empresas/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useAuditLog(empresaId: string) {
  return useQuery<AuditLog[]>({
    queryKey: ["audit", empresaId],
    queryFn: () =>
      api.get(`/api/v1/empresas/${empresaId}/audit`).then((r) => r.data),
    enabled: !!empresaId,
  });
}

export function useCreateEmpresa() {
  const qc = useQueryClient();
  return useMutation<Empresa, Error, EmpresaCreate>({
    mutationFn: (data) =>
      api.post("/api/v1/empresas", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}

export function useUpdateEmpresa(id: string) {
  const qc = useQueryClient();
  return useMutation<Empresa, Error, EmpresaUpdate>({
    mutationFn: (data) =>
      api.put(`/api/v1/empresas/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
      qc.invalidateQueries({ queryKey: ["audit", id] });
    },
  });
}

export function useSoftDeleteEmpresa() {
  const qc = useQueryClient();
  return useMutation<Empresa, Error, string>({
    mutationFn: (id) =>
      api.delete(`/api/v1/empresas/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresas"] });
    },
  });
}

// ── Módulo 2 — Demanda ────────────────────────────────────────────────────────

export function useParques(apenasAtivos = false) {
  return useQuery<Parque[]>({
    queryKey: ["parques", apenasAtivos],
    queryFn: () =>
      api
        .get("/api/v1/demanda/parques", {
          params: apenasAtivos ? { apenas_ativos: true } : {},
        })
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateParque() {
  const qc = useQueryClient();
  return useMutation<Parque, Error, ParqueCreate>({
    mutationFn: (data) =>
      api.post("/api/v1/demanda/parques", data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parques"] }),
  });
}

export function useUpdateParque() {
  const qc = useQueryClient();
  return useMutation<Parque, Error, { id: number; data: ParqueUpdate }>({
    mutationFn: ({ id, data }) =>
      api.patch(`/api/v1/demanda/parques/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parques"] }),
  });
}

export function useCidades(q: string) {
  return useQuery<Cidade[]>({
    queryKey: ["cidades", q],
    queryFn: () =>
      api
        .get("/api/v1/demanda/cidades", { params: { q } })
        .then((r) => r.data),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

export function useFormularioAtivo() {
  return useQuery<FormularioVersao>({
    queryKey: ["formulario-ativo"],
    queryFn: () =>
      api.get("/api/v1/demanda/formularios/ativo").then((r) => r.data),
    retry: false,
  });
}

export function useFormularios() {
  return useQuery<FormularioVersao[]>({
    queryKey: ["formularios"],
    queryFn: () => api.get("/api/v1/demanda/formularios").then((r) => r.data),
  });
}

export function useCreateFormulario() {
  const qc = useQueryClient();
  return useMutation<
    FormularioVersao,
    Error,
    { ano: number; schema_json: FormularioVersao["schema_json"] }
  >({
    mutationFn: (data) =>
      api.post("/api/v1/demanda/formularios", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["formularios"] });
    },
  });
}

export function useCreateResposta() {
  const qc = useQueryClient();
  return useMutation<RespostaDemanda, Error, RespostaDemandaCreate>({
    mutationFn: (data) =>
      api.post("/api/v1/demanda/respostas", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["indicadores"] });
      qc.invalidateQueries({ queryKey: ["formularios"] });
    },
  });
}

export function useIndicadores(parque?: string, ano?: number) {
  return useQuery<Indicadores>({
    queryKey: ["indicadores", parque, ano],
    queryFn: () =>
      api
        .get("/api/v1/demanda/indicadores", {
          params: { ...(parque && { parque }), ...(ano && { ano }) },
        })
        .then((r) => r.data),
  });
}

export async function downloadExport(
  formato: "xlsx" | "csv",
  parque?: string,
  ano?: number
) {
  const res = await api.get("/api/v1/demanda/export", {
    params: { formato, ...(parque && { parque }), ...(ano && { ano }) },
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([res.data]));
  const a = document.createElement("a");
  a.href = url;
  const sufixo = parque ? `${parque}_${ano ?? ""}` : `${ano ?? ""}`;
  a.download = `demanda_${sufixo}.${formato}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
