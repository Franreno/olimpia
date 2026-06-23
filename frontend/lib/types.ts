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

export type EmpresaUpdate = Partial<EmpresaCreate>;

export interface AuditLog {
  id: number;
  tabela: string;
  registro_id: string;
  usuario_id?: string;
  usuario_nome?: string | null;
  operacao: "INSERT" | "UPDATE" | "DELETE";
  campo_alterado?: string;
  valor_anterior?: unknown;
  valor_novo?: unknown;
  criado_em: string;
}

export type EmpresaStatus = "ativo" | "inativo";

// ── Módulo 2 — Pesquisa de Demanda ───────────────────────────────────────────

export interface Parque {
  id: number;
  slug: string;
  nome: string;
  ativo: boolean;
  ordem: number;
}

export interface ParqueCreate {
  nome: string;
  ordem?: number;
}

export interface ParqueUpdate {
  nome?: string;
  ativo?: boolean;
  ordem?: number;
}

export interface Cidade {
  nome: string;
  uf: string;
}

export interface CampoFormulario {
  id: string;
  label: string;
  tipo: "selecao" | "autocomplete" | "numero" | "multipla" | "escala";
  obrigatorio?: boolean;
  fonte?: string;
  min?: number;
  max?: number;
  opcoes?: Array<{ valor: string; rotulo: string }> | string[];
}

export interface RegraCoerencia {
  campo: string;
  tipo: string;
  fator?: number;
  alerta: string;
}

export interface FormularioSchema {
  campos: CampoFormulario[];
  regras_coerencia?: RegraCoerencia[];
}

export interface FormularioVersao {
  id: number;
  ano: number;
  schema_json: FormularioSchema;
  status: "ativo" | "travado";
  criado_em: string;
  criado_por?: string;
  criado_por_nome?: string | null;
  total_respostas: number;
}

export interface RespostaDemandaCreate {
  parque: string; // Parque.slug
  formulario_versao_id?: number;
  coletado_em?: string;
  estadia?: {
    estado_residencia?: string;
    cidade_residencia?: string;
    data_chegada?: string;
    data_partida?: string;
    pernoites?: number;
    meio_hospedagem?: string;
    acompanhantes_tipo?: string;
  };
  viagem?: {
    motivo_viagem?: string[];
    transporte_utilizado?: string;
    considerou_outro_destino?: boolean;
    destinos_concorrentes?: string[];
  };
  satisfacao?: {
    voltaria?: boolean;
    indicaria?: boolean;
    nps_recomendacao?: number;
    nota_destino?: number;
  };
  perfil?: {
    genero?: string;
    faixa_etaria?: string;
    renda_familiar?: string;
    gasto_medio_diario?: string;
  };
  avaliacoes_servico?: Array<{ dimensao: string; nota?: number }>;
  avaliacoes_atrativo?: Array<{ nome_atrativo: string; nota?: number }>;
}

export interface RespostaDemanda {
  id: string;
  formulario_versao_id: number;
  pesquisador_id: string;
  parque: string; // Parque.slug
  coletado_em: string;
  sync_status: string;
  alerta_coerencia: boolean;
  descricao_alerta?: string | null;
}

export interface DistribuicaoItem {
  rotulo: string;
  quantidade: number;
  pct: number;
}

export interface SerieNpsItem {
  mes: string;
  nps: number;
  respostas: number;
}

export interface Indicadores {
  parque: string | null;
  ano: number;
  total_respostas: number;
  nps: number | null;
  nps_label: string | null;
  promotores: number;
  neutros: number;
  detratores: number;
  media_pernoites: number | null;
  ticket_medio: number | null;
  mercados_emissores: DistribuicaoItem[];
  destinos_concorrentes: DistribuicaoItem[];
  serie_nps: SerieNpsItem[];
}

// ── Módulo 3 — Taxa de Ocupação Hoteleira ─────────────────────────────────────

export type PeriodoTipo = "consolidado" | "expectativa";
export type PeriodoStatus = "aberto" | "encerrado" | "publicado";

export interface PeriodoOcupacao {
  id: number;
  tipo: PeriodoTipo;
  descricao: string;
  data_inicio: string;
  data_fim: string;
  status: PeriodoStatus;
  protocolo: string | null;
  criado_em: string;
  criado_por?: string | null;
  total_respondentes: number;
  total_estabelecimentos: number;
  taxa_ponderada: number | null;
  receita_estimada: number | null;
}

export interface PeriodoCreate {
  tipo: PeriodoTipo;
  descricao: string;
  data_inicio: string;
  data_fim: string;
}

export type EstabelecimentoStatus = "respondeu" | "pendente" | "nao_responde";

export interface EstabelecimentoOcupacao {
  empresa_id: string;
  nome_fantasia: string;
  uhs: number | null;
  leitos: number | null;
  peso: number;
  status: EstabelecimentoStatus;
  taxa_ocupacao: number | null;
  diaria_media: number | null;
  receita_estimada: number | null;
  respondido_em: string | null;
  observacao: string | null;
}

export interface ResultadoOcupacao {
  periodo_id: number;
  taxa_ponderada: number | null;
  total_respondentes: number | null;
  total_leitos_respondidos: number | null;
  perc_leitos_respondidos: number | null;
  diaria_media_ponderada: number | null;
  receita_estimada: number | null;
  total_leitos_inventario: number;
  qtd_diarias: number;
  calculado_em: string | null;
}

export interface RespostaOcupacaoCreate {
  empresa_id: string;
  taxa_ocupacao: number;
  diaria_media?: number;
  uhs_informadas?: number;
  leitos_informados?: number;
  observacao?: string;
}
