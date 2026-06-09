import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type {
  Empresa,
  EmpresaCreate,
  EmpresaUpdate,
  CategoriaEmpresa,
  AuditLog,
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
