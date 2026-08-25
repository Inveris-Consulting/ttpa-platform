export type AnalyticsLocale = 'pt-BR' | 'en-US';
export type FieldKind = 'measure' | 'dimension';
export type FieldDataType = 'number' | 'string' | 'time';
export type FieldFormat = 'number' | 'currency' | 'percent';
export type KitChartType = 'bar' | 'normalizedBar' | 'line' | 'area' | 'pie' | 'funnel' | 'gauge' | 'card' | 'scatter' | 'matrix' | 'table';
export type KitFilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte' | 'dateRange';

export interface AnalyticsField {
  name: string;
  label: string;
  labelEn?: string;
  kind: FieldKind;
  dataType: FieldDataType;
  format?: FieldFormat;
  description?: string;
}

export interface AnalyticsModel {
  name: string;
  label: string;
  fields: AnalyticsField[];
}

export interface KitQueryFilter {
  field: string;
  operator: KitFilterOperator;
  value: string | string[];
}

export interface KitAnalyticsQuery {
  measures: string[];
  dimensions: string[];
  breakdown?: string;
  filters: KitQueryFilter[];
  order?: { field: string; direction: 'asc' | 'desc' };
  limit: number;
  timeGranularity?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}

export type AnalyticsRow = Record<string, string | number | null>;

export interface AnalyticsDataAdapter {
  readonly id: string;
  readonly source: 'cube' | 'supabase' | 'custom';
  getModel(): Promise<AnalyticsModel>;
  execute(query: KitAnalyticsQuery, signal?: AbortSignal): Promise<AnalyticsRow[]>;
  getDistinctValues?(field: string, search?: string, signal?: AbortSignal): Promise<Array<string | number>>;
}

export interface KitVisualizationConfig {
  type: KitChartType;
  title: string;
  colors: string[];
  orientation: 'vertical' | 'horizontal';
  labels: 'auto' | 'millions' | 'thousands' | 'none';
  decimals: number;
  valueFormat: FieldFormat;
  showLegend: boolean;
  stacked: boolean;
}

export interface SavedKitChart {
  id: string;
  name: string;
  ownerId?: string;
  folderId?: string;
  query: KitAnalyticsQuery;
  visualization: KitVisualizationConfig;
  createdAt: string;
  updatedAt: string;
}

export interface KitGridPosition { x: number; y: number; w: number; h: number }

export type KitDashboardItem =
  | { id: string; type: 'chart'; chartId: string; position: KitGridPosition }
  | { id: string; type: 'text'; title: string; content: string; position: KitGridPosition }
  | { id: string; type: 'image'; title: string; url: string; alt: string; position: KitGridPosition }
  | { id: string; type: 'iframe'; title: string; url: string; position: KitGridPosition }
  | { id: string; type: 'ai'; title: string; prompt: string; position: KitGridPosition };

export interface KitDashboard {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  folderId?: string;
  items: KitDashboardItem[];
  createdAt: string;
  updatedAt: string;
}

export type DashboardPermission = 'view' | 'edit' | 'admin';
export type KitFolderKind = 'chart' | 'dashboard';
export interface KitFolder {
  id: string;
  name: string;
  kind: KitFolderKind;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
export interface DashboardGrant { dashboardId: string; userId: string; permission: DashboardPermission }
export interface AnalyticsUser { id: string; name: string; email?: string; role: string }

export interface AnalyticsKitRepository {
  listCharts(): Promise<SavedKitChart[]>;
  saveChart(chart: SavedKitChart): Promise<SavedKitChart>;
  deleteChart(id: string): Promise<void>;
  listDashboards(): Promise<KitDashboard[]>;
  saveDashboard(dashboard: KitDashboard): Promise<KitDashboard>;
  deleteDashboard(id: string): Promise<void>;
  listFolders(kind?: KitFolderKind): Promise<KitFolder[]>;
  saveFolder(folder: KitFolder): Promise<KitFolder>;
  deleteFolder(id: string): Promise<void>;
  listGrants(dashboardId: string): Promise<DashboardGrant[]>;
  saveGrant(grant: DashboardGrant): Promise<DashboardGrant>;
  deleteGrant(dashboardId: string, userId: string): Promise<void>;
}

export interface AccessContext {
  currentUser: AnalyticsUser;
  adminRoles?: string[];
}

export interface AnalyticsStudioProps {
  adapter: AnalyticsDataAdapter;
  repository: AnalyticsKitRepository;
  locale?: AnalyticsLocale;
  currency?: string;
  ownerId?: string;
  initialQuery?: Partial<KitAnalyticsQuery>;
  onSaved?: (chart: SavedKitChart) => void;
  className?: string;
}

export interface DashboardStudioProps {
  adapter: AnalyticsDataAdapter;
  repository: AnalyticsKitRepository;
  access: AccessContext;
  users?: AnalyticsUser[];
  locale?: AnalyticsLocale;
  className?: string;
}
