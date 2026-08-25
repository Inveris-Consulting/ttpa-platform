import type { AnalyticsLocale } from './types';

const messages = {
  'pt-BR': {
    chartBuilder: 'Criar visualização', measures: 'Métricas', groupBy: 'Agrupar por', breakdown: 'Segmentar por',
    filters: 'Filtros', addFilter: 'Adicionar filtro', chartType: 'Tipo de gráfico', customize: 'Customizar',
    save: 'Salvar análise', saved: 'Análise salva', title: 'Título', orientation: 'Orientação', vertical: 'Vertical',
    horizontal: 'Horizontal', labels: 'Rótulos', decimals: 'Casas decimais', format: 'Formato', legend: 'Legenda',
    stacked: 'Empilhar séries', noResults: 'Nenhum resultado', selectMeasure: 'Selecione uma métrica',
    selectDimension: 'Selecione uma dimensão', noBreakdown: 'Sem segmentação', dashboards: 'Dashboards',
    newDashboard: 'Novo dashboard', add: 'Adicionar', access: 'Acessos', viewer: 'Visualizador', editor: 'Editor',
    administrator: 'Administrador', remove: 'Remover', loading: 'Carregando dados…', error: 'Não foi possível consultar os dados.',
  },
  'en-US': {
    chartBuilder: 'Create visualization', measures: 'Measures', groupBy: 'Group by', breakdown: 'Break down by',
    filters: 'Filters', addFilter: 'Add filter', chartType: 'Chart type', customize: 'Customize',
    save: 'Save analysis', saved: 'Analysis saved', title: 'Title', orientation: 'Orientation', vertical: 'Vertical',
    horizontal: 'Horizontal', labels: 'Labels', decimals: 'Decimal places', format: 'Format', legend: 'Legend',
    stacked: 'Stack series', noResults: 'No results', selectMeasure: 'Select a measure',
    selectDimension: 'Select a dimension', noBreakdown: 'No breakdown', dashboards: 'Dashboards',
    newDashboard: 'New dashboard', add: 'Add', access: 'Access', viewer: 'Viewer', editor: 'Editor',
    administrator: 'Administrator', remove: 'Remove', loading: 'Loading data…', error: 'Unable to query data.',
  },
} as const;

export type TranslationKey = keyof typeof messages['pt-BR'];
export function createTranslator(locale: AnalyticsLocale = 'pt-BR') {
  return (key: TranslationKey) => messages[locale][key] ?? messages['pt-BR'][key];
}
