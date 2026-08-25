import type { AnalyticsDataAdapter, AnalyticsModel, AnalyticsRow, KitAnalyticsQuery } from '../types';

export interface SupabaseRpcResult<T = unknown> { data: T | null; error: { message: string } | null }
export interface SupabaseRpcClientLike { rpc<T = unknown>(functionName: string, args?: Record<string, unknown>): PromiseLike<SupabaseRpcResult<T>> | Promise<SupabaseRpcResult<T>> | any }

export interface SupabaseRpcAdapterOptions {
  client: SupabaseRpcClientLike;
  functionName: string;
  model: AnalyticsModel;
  payloadKey?: string;
  distinctFunctionName?: string;
}

function rowsFromPayload(payload: unknown): AnalyticsRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    if (payload.length > 0 && typeof payload[0] === 'object' && payload[0] !== null && 'analytics_query' in payload[0]) {
      const nested = (payload[0] as { analytics_query: unknown }).analytics_query;
      if (Array.isArray(nested)) return nested as AnalyticsRow[];
    }
    return payload as AnalyticsRow[];
  }
  if (typeof payload === 'object') {
    if (Array.isArray((payload as { rows?: unknown }).rows)) return (payload as { rows: AnalyticsRow[] }).rows;
    if (Array.isArray((payload as { data?: unknown }).data)) return (payload as { data: AnalyticsRow[] }).data;
    if ('analytics_query' in payload && Array.isArray((payload as { analytics_query: unknown }).analytics_query)) {
      return (payload as { analytics_query: AnalyticsRow[] }).analytics_query;
    }
  }
  return [];
}

export function createSupabaseRpcAdapter(options: SupabaseRpcAdapterOptions): AnalyticsDataAdapter {
  const payloadKey = options.payloadKey ?? 'query_payload';
  return {
    id: `supabase:${options.functionName}`,
    source: 'supabase',
    getModel: async () => options.model,
    async execute(query: KitAnalyticsQuery) {
      const { data, error } = await options.client.rpc(options.functionName, { [payloadKey]: query });
      if (error) throw new Error(error.message);
      return rowsFromPayload(data);
    },
    ...(options.distinctFunctionName ? {
      async getDistinctValues(field: string, search = '') {
        const { data, error } = await options.client.rpc(options.distinctFunctionName!, { field_name: field, search_text: search });
        if (error) throw new Error(error.message);
        return Array.isArray(data) ? data.map((item) => typeof item === 'object' && item !== null && 'value' in item ? String((item as { value: unknown }).value) : String(item)) : [];
      },
    } : {}),
  };
}
