import './analytics-kit.css';
import './folder-ui.css';

export { AnalyticsStudio, ChartRenderer } from './charts';
export { AccessManager, DashboardStudio } from './dashboards';
export { createCubeAdapter, toCubeQuery } from './adapters/cubeAdapter';
export type { CubeAdapterOptions, CubeClientLike } from './adapters/cubeAdapter';
export { createSupabaseRpcAdapter } from './adapters/supabaseRpcAdapter';
export type { SupabaseRpcAdapterOptions, SupabaseRpcClientLike } from './adapters/supabaseRpcAdapter';
export { createJsonAdapter } from './adapters/jsonAdapter';
export { createLocalStorageRepository } from './storage/localStorageRepository';
export { createSupabaseRepository } from './storage/supabaseRepository';
export { hasDashboardAccess } from './access';
export type * from './types';
