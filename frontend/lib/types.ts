export interface CategoriaEmpresa {
  id: number;
  slug: string;
  nome: string;
}

export interface Empresa {
  id: string;
  categoria_id: number;
  categoria?: CategoriaEmpresa;
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  endereco?: string;
  bairro?: string;
  telefone?: string;
  email?: string;
  status: "ativo" | "inativo";
  data_baixa?: string;
  aceita_pesquisas: boolean;
  contato_pesquisas?: string;
  telefone_pesquisas?: string;
  email_pesquisas?: string;
  proprietario?: string;
  campos_extras?: Record<string, unknown>;
  criado_em: string;
  atualizado_em?: string;
  criado_por?: string;
}

export interface EmpresaCreate {
  categoria_id: number;
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  endereco?: string;
  bairro?: string;
  telefone?: string;
  email?: string;
  aceita_pesquisas?: boolean;
  contato_pesquisas?: string;
  telefone_pesquisas?: string;
  email_pesquisas?: string;
  proprietario?: string;
  campos_extras?: Record<string, unknown>;
}

export interface EmpresaUpdate extends Partial<EmpresaCreate> {}

export interface AuditLog {
  id: number;
  tabela: string;
  registro_id: string;
  usuario_id?: string;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  campo_alterado?: string;
  valor_anterior?: unknown;
  valor_novo?: unknown;
  criado_em: string;
}

export type EmpresaStatus = "ativo" | "inativo";
