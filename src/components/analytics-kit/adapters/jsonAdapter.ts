import type { AnalyticsDataAdapter, AnalyticsModel, AnalyticsRow, KitAnalyticsQuery } from '../types';

export interface JsonAdapterOptions {
  id?: string;
  model: AnalyticsModel;
  query: (query: KitAnalyticsQuery, signal?: AbortSignal) => Promise<AnalyticsRow[]>;
  distinct?: (field: string, search?: string, signal?: AbortSignal) => Promise<Array<string | number>>;
}

export function createJsonAdapter(options: JsonAdapterOptions): AnalyticsDataAdapter {
  return {
    id: options.id ?? 'custom:json', source: 'custom', getModel: async () => options.model,
    execute: options.query, ...(options.distinct ? { getDistinctValues: options.distinct } : {}),
  };
}
