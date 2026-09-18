# Guia Definitivo: Otimização de Consultas e Criação de Dashboards com React e Supabase

> **Objetivo**: Este guia consolida os aprendizados práticos de arquitetura, banco de dados (PostgreSQL/Supabase) e engenharia de frontend (React/TypeScript) aplicados em ambientes corporativos de alta demanda. Use este manual como referência e checklist para novos projetos de painéis analíticos e sistemas de inteligência operacional.

---

## Sumário
1. [Visão Geral e Princípios Fundamentais](#1-visão-geral-e-princípios-fundamentais)
2. [Arquitetura de Banco de Dados e Supabase](#2-arquitetura-de-banco-de-dados-e-supabase)
   - [2.1 Índices Estratégicos, Parciais e Funcionais](#21-índices-estratégicos-parciais-e-funcionais)
   - [2.2 Design de Funções Analíticas RPC (Remote Procedure Call)](#22-design-de-funções-analíticas-rpc-remote-procedure-call)
   - [2.3 Eliminação de Varreduras Sequenciais (Sequential Scans)](#23-eliminação-de-varreduras-sequenciais-sequential-scans)
   - [2.4 Agregação em Passada Única com `FILTER (WHERE ...)`](#24-agregação-em-passada-única-com-filter-where-)
   - [2.5 Materialização de CTEs (`AS MATERIALIZED`)](#25-materialização-de-ctes-as-materialized)
3. [Camada de Serviços e Conexão no Frontend](#3-camada-de-serviços-e-conexão-no-frontend)
   - [3.1 Semáforo de Concorrência de API (Throttling de Requests)](#31-semáforo-de-concorrência-de-api-throttling-de-requests)
   - [3.2 Desduplicação de Requisições em Voo (Promise Deduping)](#32-desduplicação-de-requisições-em-voo-promise-deduping)
   - [3.3 Política de Retentativas Inteligentes com Backoff](#33-política-de-retentativas-inteligentes-com-backoff)
4. [Engenharia de Frontend no React](#4-engenharia-de-frontend-no-react)
   - [4.1 Eliminação de Race Conditions com `activeRequestIdRef`](#41-eliminação-de-race-conditions-com-activerequestidref)
   - [4.2 Separação Granular de Efeitos (`useEffect` Desacoplado)](#42-separação-granular-de-efeitos-useeffect-desacoplado)
   - [4.3 Chave Estável de Filtros com `JSON.stringify`](#43-chave-estável-de-filtros-com-jsonstringify)
   - [4.4 Estados Visuais Coordenados (Loading, Skeleton e Opacidade)](#44-estados-visuais-coordenados-loading-skeleton-e-opacidade)
5. [Experiência de Usuário e Componentes de Dados](#5-experiência-de-usuário-e-componentes-de-dados)
   - [5.1 Paginação Interativa vs Virtualização](#51-paginação-interativa-vs-virtualização)
   - [5.2 Ordenação Universal em Memória (Strings, Números e Datas)](#52-ordenação-universal-em-memória-strings-números-e-datas)
   - [5.3 Exportação Segura em CSV (BOM UTF-8 e Escapes)](#53-exportação-segura-em-csv-bom-utf-8-e-escapes)
6. [Checklist Prático para Novos Dashboards](#6-checklist-prático-para-novos-dashboards)

---

## 1. Visão Geral e Princípios Fundamentais

Um dashboard lento ou instável geralmente sofre de um destes três sintomas:
1. **Timeouts no Supabase/PostgREST** (`canceling statement due to statement timeout`): consultas demoram mais que o teto padrão (8 a 10s) devido a falta de índices ou junções ineficientes.
2. **Cards e Gráficos Dessincronizados**: o frontend dispara chamadas paralelas sem controle de concorrência, fazendo com que uma requisição antiga atrase e sobrescreva dados novos (*race condition*).
3. **Travamento no Navegador**: renderização excessiva de milhares de elementos HTML na tela ao mesmo tempo (falta de paginação ou virtualização).

### A Regra de Ouro da Performance:
> **"Filtre e agregue o máximo no Postgres via RPC compilada; entregue ao React apenas JSON estruturado pronto para consumo; no cliente, gerencie apenas apresentação, concorrência e paginação."**

---

## 2. Arquitetura de Banco de Dados e Supabase

### 2.1 Índices Estratégicos, Parciais e Funcionais

Sem índices adequados, o PostgreSQL é obrigado a ler o disco bloco por bloco (*Sequential Scan*). Em tabelas com mais de 50.000 ou 100.000 registros (como tabelas de chamadas ou logs), uma simples filtragem de data pode consumir segundos de CPU.

#### A. Índices Compostos por Filtro Temporal e Chave Estrangeira
Sempre que uma tabela de fatos for consultada por intervalo de data combinado a um cliente, filial ou representante:
```sql
-- Exemplo: fCalls filtrado por Date e representative_id
CREATE INDEX IF NOT EXISTS idx_fcalls_date_rep 
    ON public."fCalls" ("Date", representative_id);

CREATE INDEX IF NOT EXISTS idx_fsubmissions_date_rep 
    ON public."fSubmissions" ("Date", representative_id);
```

#### B. Índices Parciais (Filtered Indexes)
Se a grande maioria das suas consultas filtra registros com `status = 'Ativo'`, criar um índice na tabela inteira é desperdício de espaço e I/O.
*(Padrão extraído do Vaga Lumi)*:
```sql
-- Indexa apenas os usuários ativos, reduzindo o tamanho do índice em até 80%
CREATE INDEX IF NOT EXISTS idx_users_dashboard_active_scope
    ON public.users (client_id, role, manager_id, id)
    WHERE status = 'Ativo';
```

#### C. Índices Funcionais (Expression Indexes)
Se você precisa comparar dados higienizados (ex: e-mail em minúsculas ou telefones sem caracteres especiais), crie um índice funcional diretamente na expressão:
```sql
-- Busca rápida insensível a maiúsculas/minúsculas
CREATE INDEX IF NOT EXISTS idx_fsubmissions_lower_email 
    ON public."fSubmissions" (lower("Email"));

-- Busca rápida de telefone apenas com dígitos (últimos 10 dígitos)
CREATE INDEX IF NOT EXISTS idx_dcontacts_crm_phone_clean 
    ON public."dContacts_crm" (right(regexp_replace("Phone", '\D', '', 'g'), 10));
```

---

### 2.2 Design de Funções Analíticas RPC (Remote Procedure Call)

Em vez de fazer múltiplas chamadas `supabase.from('tabela').select(...)` no frontend, crie uma RPC no Postgres com `SECURITY DEFINER` e `STABLE`.

**Vantagens**:
- Execução compilada no servidor.
- Uma única viagem de rede (HTTP roundtrip).
- Retorno de um único objeto JSON (`json_build_object`) contendo KPIs, gráficos e totais de uma só vez.

```sql
CREATE OR REPLACE FUNCTION public.get_dashboard_analytics(
  p_start_date DATE,
  p_end_date DATE,
  p_representative TEXT DEFAULT 'All'
)
RETURNS JSON 
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Lógica analítica aqui...
  RETURN v_result;
END;
$$;
```

---

### 2.3 Eliminação de Varreduras Sequenciais (Sequential Scans)

#### O Anti-Padrão: `LATERAL` Join com `OR`
```sql
-- ❌ PÉSSIMO: Faz varredura sequencial completa em dContacts_crm para CADA linha
LEFT JOIN LATERAL (
  SELECT ct.* FROM public."dContacts_crm" ct
  WHERE (s."Email" = ct."Email") OR (s."Contact ID" = ct."Contact ID")
  LIMIT 1
) ct ON TRUE
```
*Impacto*: Em 400 linhas de submissões cruzando 9.000 contatos, isso gera mais de **3.600.000 comparações**, levando de 5 a 10 segundos!

#### A Solução Otimizada: Lookups Diretos Indexados com `COALESCE`
```sql
-- ✅ EXCELENTE: Dois B-Tree Lookups diretos de O(1), executando em ~0.05ms cada
LEFT JOIN public."dContacts_crm" ct_email 
  ON s."Email" IS NOT NULL AND s."Email" <> '' AND LOWER(s."Email") = LOWER(ct_email."Email")
LEFT JOIN public."dContacts_crm" ct_id 
  ON ct_email."Email" IS NULL AND s."Contact ID" IS NOT NULL AND s."Contact ID" = ct_id."Contact ID"
```

#### Curto-Circuito Booleano em Filtros Opcionais
Se o usuário selecionou `"All Forms"`, nunca force o banco a fazer join para buscar o nome do formulário:
```sql
WHERE c."Date" >= v_start_date AND c."Date" <= v_end_date
  AND (
    p_form_name = 'All Forms' 
    OR EXISTS (
      SELECT 1 FROM public."dContacts_crm" ct
      WHERE ct."Form Name" = p_form_name
        AND ct.phone_clean = c.phone_clean
    )
  )
```
*O Postgres avalia o lado esquerdo do `OR` e sequer toca em `dContacts_crm` quando o filtro for 'All Forms'.*

---

### 2.4 Agregação em Passada Única com `FILTER (WHERE ...)`

*(Padrão do Vaga Lumi)*:
Em vez de fazer 4 subqueries para contar diferentes categorias de registros, faça **uma única passada de leitura** sobre a tabela:

```sql
-- ✅ Contagem agregada de múltiplas dimensões em 1 único scan
SELECT
    count(DISTINCT collaborator.id)::bigint AS active_collaborators,
    count(DISTINCT collaborator.id) FILTER (WHERE lower(collaborator.role) = 'colaborador')::bigint AS collaborators,
    count(DISTINCT collaborator.id) FILTER (WHERE lower(collaborator.role) = 'lider')::bigint AS leaders,
    count(DISTINCT collaborator.id) FILTER (WHERE lower(collaborator.role) = 'gestor')::bigint AS managers
FROM scoped_collaborators collaborator;
```

---

### 2.5 Materialização de CTEs (`AS MATERIALIZED`)

*(Padrão do Vaga Lumi)*:
No PostgreSQL 12+, CTEs (`WITH nome AS (...)`) podem ser inseridas diretamente na query principal pelo otimizador (*inlining*), recalculando subqueries pesadas várias vezes. O modificador `MATERIALIZED` instrui o Postgres a calcular a CTE **uma única vez** e armazenar o resultado temporário na memória RAM:

```sql
WITH scoped_companies AS MATERIALIZED (
    SELECT company.id, company.name
    FROM public.companies company
    WHERE company.status = 'Ativo'
      AND (p_company_ids IS NULL OR company.id = ANY(p_company_ids))
)
-- As consultas seguintes reutilizam o resultado materializado instantaneamente
```

---

## 3. Camada de Serviços e Conexão no Frontend

### 3.1 Semáforo de Concorrência de API (Throttling de Requests)

Quando uma página abre 6 widgets e cada um dispara uma query via Supabase SDK, o pool de conexões do navegador e do PostgREST é inundado, elevando o tempo de resposta e gerando cancelamento de queries.

*(Padrão do Vaga Lumi `analyticsService.ts`)*:
```typescript
// Limita requisições simultâneas a 2 por vez para evitar saturação do banco
const API_CONCURRENCY_LIMIT = 2;
let inFlightApiRequests = 0;
const apiQueueResolvers: Array<() => void> = [];

export async function waitForApiSlot(): Promise<void> {
  if (inFlightApiRequests < API_CONCURRENCY_LIMIT) {
    inFlightApiRequests += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    apiQueueResolvers.push(resolve);
  });
  inFlightApiRequests += 1;
}

export function releaseApiSlot(): void {
  inFlightApiRequests = Math.max(0, inFlightApiRequests - 1);
  const next = apiQueueResolvers.shift();
  if (next) next();
}
```

---

### 3.2 Desduplicação de Requisições em Voo (Promise Deduping)

Se dois componentes distintos solicitam o mesmo endpoint com os mesmos filtros ao mesmo tempo, armazene a **Promise em andamento** em um `Map`:

```typescript
const inFlightPromises = new Map<string, Promise<any>>();

export async function fetchWithDedup<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  if (inFlightPromises.has(cacheKey)) {
    return inFlightPromises.get(cacheKey) as Promise<T>;
  }

  const promise = (async () => {
    await waitForApiSlot();
    try {
      return await fetcher();
    } finally {
      releaseApiSlot();
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, promise);
  return promise;
}
```

---

### 3.3 Política de Retentativas Inteligentes com Backoff

Consultas analíticas podem sofrer falhas transitórias de conexão. Uma função genérica de retry com jitter/delay previne que erros esporádicos quebrem a experiência do usuário:

```typescript
async function fetchWithRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (attempts <= 1) throw error;
    await new Promise((r) => setTimeout(r, delayMs));
    return fetchWithRetry(fn, attempts - 1, delayMs * 1.5);
  }
}
```

---

## 4. Engenharia de Frontend no React

### 4.1 Eliminação de Race Conditions com `activeRequestIdRef`

Quando o usuário clica rapidamente entre datas (ex: 01/08 -> 15/08 -> 20/08), as requisições antigas ainda estão navegando pela rede. A requisição antiga pode resolver **depois** da mais recente e sobrescrever o estado da aplicação com dados defasados.

```typescript
export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loading, setLoading] = useState(false);
  const activeRequestIdRef = React.useRef(0);

  const fetchDashboardData = async () => {
    // 1. Gera um identificador único sequencial para este disparo
    const requestId = ++activeRequestIdRef.current;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_dashboard_metrics', { ... });

      // 2. Se o usuário já selecionou outro filtro enquanto essa query rodava, descarte!
      if (requestId !== activeRequestIdRef.current) return;

      if (!error && data) {
        setMetrics(data);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  };
};
```

---

### 4.2 Separação Granular de Efeitos (`useEffect` Desacoplado)

Nunca coloque todos os filtros em um único `useEffect` monolítico se eles atendem a propósitos diferentes:

```typescript
// ✅ CORRETO: KPIs respondem apenas a filtros de escopo/período
useEffect(() => {
  fetchDashboardKpis();
}, [startDate, endDate, selectedRep, selectedForm]);

// ✅ Gráficos respondem aos filtros de escopo E aos controles visuais locais
useEffect(() => {
  fetchDashboardCharts();
}, [startDate, endDate, selectedRep, selectedForm, selectedMetric, granularity]);
```
*Benefício*: Quando o usuário apenas alternar entre visualização por "Dia", "Semana" ou "Mês", a consulta pesada de KPIs dos cards **não** será reexecutada inutilmente.

---

### 4.3 Chave Estável de Filtros com `JSON.stringify`

*(Padrão do Vaga Lumi `useDashboardData.ts`)*:
Passar objetos literais como dependência de `useEffect` provoca loops infinitos de re-render porque `{ rep: 'A' } !== { rep: 'A' }` em JavaScript por referência.

```typescript
const filtersKey = useMemo(() => {
  return JSON.stringify({
    startDate,
    endDate,
    selectedRep,
    selectedForm,
  });
}, [startDate, endDate, selectedRep, selectedForm]);

useEffect(() => {
  const parsedFilters = JSON.parse(filtersKey);
  loadDashboard(parsedFilters);
}, [filtersKey]); // ✅ Dispara APENAS quando os valores internos mudarem de fato
```

---

### 4.4 Estados Visuais Coordenados (Loading, Skeleton e Opacidade)

Evite o efeito onde gráficos somem ou cards exibem `0` enquanto a busca acontece. Em vez disso, use opacidade controlada e bloqueio de cliques nos cards:

```tsx
<div 
  className="kpi-grid"
  style={{
    opacity: loadingKpis ? 0.6 : 1,
    pointerEvents: loadingKpis ? 'none' : 'auto',
    transition: 'opacity 0.2s ease',
  }}
>
  {kpis.map((kpi) => (
    <KPICard key={kpi.id} {...kpi} />
  ))}
</div>
```

---

## 5. Experiência de Usuário e Componentes de Dados

### 5.1 Paginação Interativa vs Virtualização

Renderizar mais de 200 linhas em uma tabela HTML convencional derruba a performance de rolagem para menos de 30 fps.

**Regra de decisão**:
- **Paginação (Recomendada para tabelas de auditoria/contatos)**: Oferece navegação previsível, seletor de linhas por página (10, 20, 50, 100) e controle de página atual (`slice((page - 1) * size, page * size)`).
- **Virtualização (ex: TanStack Virtual)**: Para tabelas com rolagem contínua (estilo Excel) com mais de 5.000 linhas na mesma visão.

#### Exemplo de Paginação Leve no Cliente:
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [pageSize, setPageSize] = useState(20);

// Reset para a 1ª página ao filtrar ou ordenar
useEffect(() => {
  setCurrentPage(1);
}, [searchQuery, sortField, sortDirection]);

const totalPages = Math.max(Math.ceil(filteredRows.length / pageSize), 1);
const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
```

---

### 5.2 Ordenação Universal em Memória (Strings, Números e Datas)

Para garantir que nomes, e-mails e datas no formato brasileiro (`DD/MM/YYYY`) ou ISO sejam ordenados sem bugs:

```typescript
const parseDateValue = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 0;
  const trimmed = dateStr.trim();
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  const t = new Date(trimmed).getTime();
  return isNaN(t) ? 0 : t;
};

const sortedRows = [...filteredRows].sort((a, b) => {
  let comparison = 0;

  if (sortField === 'date') {
    comparison = parseDateValue(a.date) - parseDateValue(b.date);
  } else {
    const valA = (a[sortField] ?? '').toString().trim();
    const valB = (b[sortField] ?? '').toString().trim();
    // localeCompare trata acentuação e ordenação natural de números
    comparison = valA.localeCompare(valB, undefined, { sensitivity: 'base', numeric: true });
  }

  return sortDirection === 'asc' ? comparison : -comparison;
});
```

---

### 5.3 Exportação Segura em CSV (BOM UTF-8 e Escapes)

Um erro clássico em exportações CSV web é abrir o arquivo no Excel e os acentos (ex: *Não*, *São Paulo*) aparecerem corrompidos (`No`, `So Paulo`). 

**A solução definitiva**: adicione o marcador Byte Order Mark (`\uFEFF`) no início do arquivo e aplique escape de aspas duplas:

```typescript
export const exportToCSV = (rows: any[], headers: string[], filename: string) => {
  if (rows.length === 0) return;

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows = rows.map((row) =>
    headers.map((h) => escapeCSV(row[h])).join(',')
  );

  // \uFEFF força o Excel a interpretar o arquivo como UTF-8
  const csvContent = '\uFEFF' + [
    headers.map((h) => `"${h}"`).join(','),
    ...csvRows,
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
```

---

## 6. Checklist Prático para Novos Dashboards

Antes de entregar qualquer dashboard para produção, execute este checklist:

- [ ] **Índices de Partição Temporal**: As tabelas de fatos possuem índice composto nas colunas de data e chaves de filtro (`Date, representative_id`)?
- [ ] **Evitar `LATERAL` Scans com `OR`**: As junções relacionais usam index lookups diretos em vez de varreduras sequenciais aninhadas?
- [ ] **Curto-Circuito em Filtros Opcionais**: Filtros do tipo "Todos" ignoram as tabelas dimensionais secundárias no SQL?
- [ ] **Controle de Concorrência**: O frontend possui `activeRequestIdRef` ou `AbortController` para descartar respostas defasadas?
- [ ] **Desacoplamento de Efeitos**: Os KPIs gerais deixam de ser recalculados quando o usuário só muda a granularidade ou visualização de um gráfico?
- [ ] **Semáforo de Requests**: A aplicação protege a API contra rajadas de consultas paralelas?
- [ ] **Paginação**: Tabelas com mais de 50 registros estão paginadas ou virtualizadas?
- [ ] **Exportação CSV com UTF-8 BOM**: Os arquivos exportados abrem com acentos corretos no Excel?
- [ ] **Benchmark de Tempo de Resposta**: Nenhuma RPC do dashboard ultrapassa 500ms em períodos de pico ou meses fechados (`EXPLAIN ANALYZE`)?

---

*Documento gerado como padrão de engenharia para projetos da Inveris e R&R Plataformas Analíticas.*
