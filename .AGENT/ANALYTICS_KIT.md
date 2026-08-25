# Analytics Kit

Kit React portátil para criação de análises, gráficos e dashboards com suporte a Cube, Supabase RPC e qualquer API que retorne JSON.

O kit fica em `src/components/analytics-kit` e não depende dos componentes originais desta POC. A demonstração possui páginas dedicadas em `/analytics-kit/explorar` e `/analytics-kit/dashboards`; `/analytics` e `/dashboards` continuam usando a implementação validada.

## O que está incluído

- `AnalyticsStudio`: construtor de consultas e gráficos.
- `DashboardStudio`: dashboards em grid, com arrastar e redimensionar.
- `AccessManager`: permissões por dashboard e acesso total por `role`.
- `ChartRenderer`: renderizador desacoplado para gráficos salvos.
- Adaptadores para Cube, Supabase RPC e JSON.
- Repositório de demonstração em `localStorage`.
- Português e inglês configurados exclusivamente por código.

## Dependências

O projeto que receber o kit precisa ter:

```bash
npm install react react-dom recharts lucide-react
```

Para Cube, instale também o cliente oficial:

```bash
npm install @cubejs-client/core
```

Para Supabase:

```bash
npm install @supabase/supabase-js
```

## Instalação por cópia

1. Copie toda a pasta:

```text
src/components/analytics-kit
├── charts
│   ├── AnalyticsStudio.tsx
│   ├── ChartRenderer.tsx
│   └── index.ts
├── dashboards
│   ├── DashboardStudio.tsx
│   ├── AccessManager.tsx
│   └── index.ts
├── adapters
├── storage
├── analytics-kit.css
├── folder-ui.css
├── types.ts
├── i18n.ts
└── index.ts
```

2. Não copie somente `AnalyticsStudio.tsx`. O arquivo utiliza os tipos, adaptadores, renderer e CSS que estão na mesma pasta.
3. Importe pelo `index.ts`:

```tsx
import {
  AnalyticsStudio,
  DashboardStudio,
  createCubeAdapter,
  createLocalStorageRepository,
} from '@/components/analytics-kit';
```

O `index.ts` já importa `analytics-kit.css`. As classes são prefixadas com `ak-` para reduzir conflitos com o projeto hospedeiro.

## Páginas dedicadas da demonstração

A integração de exemplo replica a estrutura de um produto completo sem colocar os dois builders no mesmo componente:

```text
src/pages
├── AnalyticsKitPage.tsx             # layout e navegação da área
├── AnalyticsKitExplorePage.tsx      # página composta por AnalyticsStudio
├── AnalyticsKitDashboardsPage.tsx   # página composta por DashboardStudio
└── analyticsKitDemo.ts              # adapter, repository, modelo e acesso compartilhados
```

Rotas:

- `/analytics-kit` redireciona para `/analytics-kit/explorar`.
- `/analytics-kit/explorar` cria e salva análises.
- `/analytics-kit/dashboards` organiza dashboards e reutiliza as análises salvas.

Em outro produto, replique esse padrão e substitua apenas `analyticsKitDemo.ts` pela integração real com Cube ou Supabase. As páginas permanecem pequenas e declarativas.

## Conceito principal: um componente, vários adaptadores

O componente visual não conhece Cube, Supabase ou SQL. Ele conversa com o contrato `AnalyticsDataAdapter`:

```ts
interface AnalyticsDataAdapter {
  id: string;
  source: 'cube' | 'supabase' | 'custom';
  getModel(): Promise<AnalyticsModel>;
  execute(query: KitAnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsRow[]>;
  getDistinctValues?(field: string, search?: string, signal?: AbortSignal): Promise<Array<string | number>>;
}
```

Por isso não existem duas cópias da interface. Cube e Supabase são apenas traduções diferentes da mesma consulta.

## Modelo semântico

Todos os adaptadores expõem campos no mesmo formato:

```ts
const model = {
  name: 'Sales',
  label: 'Vendas',
  fields: [
    {
      name: 'revenue',
      label: 'Receita',
      labelEn: 'Revenue',
      kind: 'measure',
      dataType: 'number',
      format: 'currency',
    },
    {
      name: 'region',
      label: 'Região',
      labelEn: 'Region',
      kind: 'dimension',
      dataType: 'string',
    },
  ],
} satisfies AnalyticsModel;
```

Os nomes de `measures`, `dimensions`, `breakdown` e filtros precisam corresponder a `field.name`.

## Uso com Cube

Crie normalmente o cliente Cube:

```ts
import cubejs from '@cubejs-client/core';
import { createCubeAdapter } from '@/components/analytics-kit';

const cubeApi = cubejs(import.meta.env.VITE_CUBE_TOKEN, {
  apiUrl: `${import.meta.env.VITE_CUBE_API_URL}/cubejs-api/v1`,
});

export const analyticsAdapter = createCubeAdapter({
  cubeApi,
  cubeName: 'Sales',
});
```

Depois, use o componente em uma página:

```tsx
import {
  AnalyticsStudio,
  createLocalStorageRepository,
} from '@/components/analytics-kit';
import { analyticsAdapter } from './analyticsAdapter';

const repository = createLocalStorageRepository('meu-produto.analytics');

export function AnalyticsPage() {
  return (
    <AnalyticsStudio
      adapter={analyticsAdapter}
      repository={repository}
      ownerId="current-user-id"
      locale="pt-BR"
      currency="BRL"
    />
  );
}
```

O adaptador:

- Carrega os metadados com `cubeApi.meta()` apenas uma vez.
- Traduz métricas, dimensões, segmentação, filtros, ordenação e limite.
- Executa com `cubeApi.load()`.
- Converte `tablePivot()` para o formato interno do kit.

Se o nome usado na interface for diferente do membro Cube, utilize `fieldMap`:

```ts
createCubeAdapter({
  cubeApi,
  cubeName: 'Sales',
  fieldMap: {
    revenue: 'Sales.totalRevenue',
    customer: 'Customers.name',
  },
});
```

Também é possível fornecer `model` explicitamente. Isso evita depender da inferência de metadados e permite definir traduções em inglês.

## Uso com Supabase RPC

O navegador não deve enviar SQL livre. Ele envia uma consulta JSON para uma function PostgreSQL fixa.

```ts
import { createClient } from '@supabase/supabase-js';
import { createSupabaseRpcAdapter } from '@/components/analytics-kit';
import { model } from './analyticsModel';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const analyticsAdapter = createSupabaseRpcAdapter({
  client: supabase,
  functionName: 'analytics_query',
  distinctFunctionName: 'analytics_distinct_values',
  payloadKey: 'query_payload',
  model,
});
```

A RPC recebe um objeto semelhante a:

```json
{
  "measures": ["revenue"],
  "dimensions": ["region"],
  "breakdown": "state",
  "filters": [
    { "field": "channel", "operator": "in", "value": ["Direct", "Online"] }
  ],
  "order": { "field": "revenue", "direction": "desc" },
  "limit": 25,
  "timeGranularity": "month"
}
```

A resposta pode ser diretamente um array ou `{ "rows": [...] }`:

```json
{
  "rows": [
    { "region": "Nordeste", "state": "CE", "revenue": 1250000 },
    { "region": "Nordeste", "state": "PE", "revenue": 980000 }
  ]
}
```

### Regras para a function SQL

- Nunca execute um texto SQL recebido do cliente.
- Mantenha allowlists de métricas, dimensões, operadores e ordenações.
- Utilize parâmetros para os valores dos filtros.
- Respeite RLS e o usuário autenticado.
- Prefira `security invoker`. Se `security definer` for indispensável, fixe o `search_path` e faça autorização explícita.
- Limite quantidade de linhas, tempo de execução e cardinalidade de dimensões.

Exemplo de assinatura:

```sql
create or replace function public.analytics_query(query_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  allowed_measures constant text[] := array['revenue', 'profit', 'orders'];
  allowed_dimensions constant text[] := array['region', 'state', 'category', 'date'];
  requested_measures text[];
begin
  select array_agg(value::text)
    into requested_measures
    from jsonb_array_elements_text(query_payload->'measures');

  if requested_measures is null
     or not requested_measures <@ allowed_measures then
    raise exception 'Invalid analytics measure';
  end if;

  -- Monte a consulta somente a partir das allowlists.
  -- Os valores dos filtros devem ser passados com USING, nunca concatenados.
  -- Retorne jsonb_agg(to_jsonb(result_row)).

  return '[]'::jsonb;
end;
$$;
```

O trecho é um contrato inicial, não uma implementação de SQL dinâmico completa. Cada projeto deve mapear os campos permitidos para suas tabelas, views ou materialized views.

## API JSON sem Cube ou Supabase

Use `createJsonAdapter`:

```ts
const adapter = createJsonAdapter({
  model,
  query: async (query, signal) => {
    const response = await fetch('/api/analytics/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query),
      signal,
    });

    if (!response.ok) throw new Error('Analytics request failed');
    return response.json();
  },
  distinct: async (field, search, signal) => {
    const response = await fetch(
      `/api/analytics/distinct?field=${encodeURIComponent(field)}&search=${encodeURIComponent(search ?? '')}`,
      { signal },
    );
    return response.json();
  },
});
```

## Português e inglês

Não existe seletor na interface. A linguagem é definida na integração:

```tsx
<AnalyticsStudio locale="pt-BR" {...props} />
```

```tsx
<AnalyticsStudio locale="en-US" {...props} />
```

O mesmo vale para dashboards:

```tsx
<DashboardStudio locale="en-US" {...props} />
```

Use `labelEn` no modelo para traduzir nomes de métricas e dimensões.

## Dashboard Builder

```tsx
const users = [
  { id: '1', name: 'Admin', role: 'admin' },
  { id: '2', name: 'Analyst', role: 'analyst' },
];

<DashboardStudio
  adapter={analyticsAdapter}
  repository={repository}
  locale="pt-BR"
  users={users}
  access={{
    currentUser: users[0],
    adminRoles: ['admin', 'super_admin'],
  }}
/>
```

O dashboard usa grid de 12 colunas. O usuário pode:

- Adicionar gráficos salvos.
- Arrastar pelo cabeçalho.
- Redimensionar pelo canto inferior direito.
- Gerenciar permissões quando possui acesso `admin`.
- Criar dashboards e adicionar textos usando modais internos do kit, sem `window.prompt`, `alert` ou `confirm`.

## Organização em pastas

Pastas são entidades funcionais do kit, e não diretórios do código-fonte. Ao salvar uma análise ou criar um dashboard, o usuário pode escolher uma pasta existente, criar outra no próprio modal ou deixar o item sem pasta.

Existem dois escopos independentes:

- `chart`: organiza análises e gráficos salvos.
- `dashboard`: organiza dashboards.

Cada análise e dashboard armazena apenas `folderId`. A entidade `KitFolder` mantém nome, tipo, proprietário e datas. O Dashboard Builder apresenta dashboards agrupados na barra lateral e gráficos agrupados no menu de inclusão. Itens antigos, criados antes desse recurso, continuam disponíveis em **Sem pasta**.

Ao excluir uma pasta em uma implementação de produção, preserve o conteúdo e apenas remova seu `folderId`. Esse é o comportamento do repositório de `localStorage` incluído.

## Regras de acesso

Permissões disponíveis:

- `view`: visualização.
- `edit`: visualização e edição do grid.
- `admin`: edição e gestão de acessos.

O proprietário e roles presentes em `adminRoles` têm acesso completo.

O componente faz controle visual, mas produção também precisa validar permissões no backend. Para Supabase, use RLS em `dashboards`, `dashboard_items` e `dashboard_members`. Nunca confie apenas em `users.role` enviado pelo navegador.

Estrutura sugerida:

```text
profiles(id, role)
analytics_folders(id, owner_id, kind, name, created_at, updated_at)
dashboards(id, owner_id, folder_id, name, description, created_at, updated_at)
dashboard_items(id, dashboard_id, type, position jsonb, config jsonb)
dashboard_members(dashboard_id, user_id, permission)
analytics_charts(id, owner_id, folder_id, name, query jsonb, visualization jsonb)
```

Em Postgres, use uma restrição para `analytics_folders.kind in ('chart', 'dashboard')` e chaves estrangeiras opcionais com `on delete set null` em `folder_id`. RLS deve restringir pastas e conteúdo pelo proprietário e pelas permissões do dashboard.

## Persistência

`createLocalStorageRepository` deve ser usado somente em protótipos:

```ts
const repository = createLocalStorageRepository('produto.analytics');
```

Em produção, implemente `AnalyticsKitRepository` usando Supabase ou sua API. A troca não exige alterações no `AnalyticsStudio` ou `DashboardStudio`.

```ts
const repository: AnalyticsKitRepository = {
  listCharts: async () => { /* ... */ },
  saveChart: async (chart) => { /* ... */ },
  deleteChart: async (id) => { /* ... */ },
  listDashboards: async () => { /* ... */ },
  saveDashboard: async (dashboard) => { /* ... */ },
  deleteDashboard: async (id) => { /* ... */ },
  listFolders: async (kind) => { /* ... */ },
  saveFolder: async (folder) => { /* ... */ },
  deleteFolder: async (id) => { /* ... */ },
  listGrants: async (dashboardId) => { /* ... */ },
  saveGrant: async (grant) => { /* ... */ },
  deleteGrant: async (dashboardId, userId) => { /* ... */ },
};
```

## Exportações principais

```ts
import {
  AccessManager,
  AnalyticsStudio,
  ChartRenderer,
  DashboardStudio,
  createCubeAdapter,
  createJsonAdapter,
  createLocalStorageRepository,
  createSupabaseRpcAdapter,
  hasDashboardAccess,
  toCubeQuery,
} from '@/components/analytics-kit';
```

Todos os tipos públicos também são exportados pelo `index.ts`.

## Otimização de carregamento e Code-Splitting (React.lazy)

Embora o kit seja eficiente, componentes analíticos ricos e bibliotecas gráficas (como Recharts) possuem impacto no tamanho do bundle. Caso o sistema hospedeiro deseje otimizar o carregamento inicial (*First Contentful Paint*) ou isolar o kit para ser baixado apenas quando o usuário navegar para a área analítica, recomenda-se o uso de `React.lazy` com `Suspense`:

```tsx
import { lazy, Suspense } from 'react';
import type { AnalyticsStudioProps, DashboardStudioProps } from '@/components/analytics-kit';

// Carregamento sob demanda dos builders do kit
const AnalyticsStudio = lazy(() =>
  import('@/components/analytics-kit').then((module) => ({ default: module.AnalyticsStudio }))
);

const DashboardStudio = lazy(() =>
  import('@/components/analytics-kit').then((module) => ({ default: module.DashboardStudio }))
);

export function LazyExplorePage(props: AnalyticsStudioProps) {
  return (
    <Suspense fallback={<div className="analytics-kit ak-loading">Carregando módulo analítico…</div>}>
      <AnalyticsStudio {...props} />
    </Suspense>
  );
}

export function LazyDashboardsPage(props: DashboardStudioProps) {
  return (
    <Suspense fallback={<div className="analytics-kit ak-loading">Carregando dashboards…</div>}>
      <DashboardStudio {...props} />
    </Suspense>
  );
}
```

Dessa forma, o bundler (Vite/Webpack) gera um chunk separado e o navegador baixa os módulos do kit apenas quando a rota for acessada.

## Checklist para outro projeto

1. Copiar a pasta completa `analytics-kit`.
2. Instalar React, Recharts e Lucide.
3. Criar o modelo semântico ou permitir que o adaptador Cube o descubra.
4. Criar o adaptador da fonte.
5. Criar um repository.
6. Implementar pastas no repository e definir `locale`, moeda e usuário atual.
7. Importar `AnalyticsStudio` e/ou `DashboardStudio` na página (diretamente ou via `React.lazy`).
8. Proteger APIs e tabelas no backend.
9. Testar consultas com alta cardinalidade e limites.
10. Trocar `localStorage` por persistência de produção antes da publicação.
