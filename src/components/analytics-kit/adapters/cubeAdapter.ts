import type { AnalyticsDataAdapter, AnalyticsField, AnalyticsModel, AnalyticsRow, KitAnalyticsQuery, KitQueryFilter } from '../types';

interface CubeResultLike { tablePivot(): AnalyticsRow[] }
interface CubeMetaLike { cubes?: Array<Record<string, unknown>> }
export interface CubeClientLike {
  meta(): Promise<CubeMetaLike | { cubes: Array<Record<string, unknown>> }>;
  load(query: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<CubeResultLike>;
}

export interface CubeAdapterOptions {
  cubeApi: CubeClientLike;
  cubeName: string;
  model?: AnalyticsModel;
  fieldMap?: Record<string, string>;
}

const memberName = (cube: string, field: string, map?: Record<string, string>) => map?.[field] ?? `${cube}.${field}`;

function cubeFilter(cube: string, filter: KitQueryFilter, map?: Record<string, string>) {
  const values = Array.isArray(filter.value) ? filter.value.map(String) : [String(filter.value)];
  return { member: memberName(cube, filter.field, map), operator: filter.operator === 'in' ? 'equals' : filter.operator === 'notIn' ? 'notEquals' : filter.operator, values };
}

function inferModel(meta: CubeMetaLike, cubeName: string): AnalyticsModel {
  const cube = meta.cubes?.find((item) => item.name === cubeName) ?? meta.cubes?.[0] ?? {};
  const readFields = (value: unknown, kind: AnalyticsField['kind']): AnalyticsField[] => Array.isArray(value) ? value.map((item): AnalyticsField => {
    const field = item as Record<string, unknown>;
    const name = String(field.name ?? '').replace(`${cubeName}.`, '');
    return { name, label: String(field.title ?? field.shortTitle ?? name), kind, dataType: kind === 'measure' ? 'number' : field.type === 'time' ? 'time' : 'string', format: field.format === 'currency' ? 'currency' : field.format === 'percent' ? 'percent' : kind === 'measure' ? 'number' : undefined };
  }) : [];
  return { name: cubeName, label: String(cube.title ?? cubeName), fields: [...readFields(cube.measures, 'measure'), ...readFields(cube.dimensions, 'dimension')] };
}

export function createCubeAdapter(options: CubeAdapterOptions): AnalyticsDataAdapter {
  let modelPromise: Promise<AnalyticsModel> | null = null;
  const getModel = () => options.model ? Promise.resolve(options.model) : (modelPromise ??= options.cubeApi.meta().then((meta) => inferModel(meta, options.cubeName)));
  return {
    id: `cube:${options.cubeName}`,
    source: 'cube',
    getModel,
    async execute(query, signal) {
      const dimensions = [...query.dimensions, ...(query.breakdown && !query.dimensions.includes(query.breakdown) ? [query.breakdown] : [])];
      const timeField = dimensions.find((field) => (options.model?.fields.find((item) => item.name === field)?.dataType === 'time'));
      const cubeQuery = {
        measures: query.measures.map((field) => memberName(options.cubeName, field, options.fieldMap)),
        dimensions: dimensions.filter((field) => field !== timeField).map((field) => memberName(options.cubeName, field, options.fieldMap)),
        timeDimensions: timeField ? [{ dimension: memberName(options.cubeName, timeField, options.fieldMap), granularity: query.timeGranularity ?? 'month' }] : [],
        filters: query.filters.map((filter) => cubeFilter(options.cubeName, filter, options.fieldMap)),
        order: query.order ? { [memberName(options.cubeName, query.order.field, options.fieldMap)]: query.order.direction } : undefined,
        limit: query.limit,
      };
      const result = await options.cubeApi.load(cubeQuery, { signal });
      return result.tablePivot().map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key.replace(`${options.cubeName}.`, ''), value])) as AnalyticsRow);
    },
  };
}

export function toCubeQuery(query: KitAnalyticsQuery, cubeName: string, fieldMap?: Record<string, string>) {
  const dimensions = [...query.dimensions, ...(query.breakdown && !query.dimensions.includes(query.breakdown) ? [query.breakdown] : [])];
  return {
    measures: query.measures.map((field) => memberName(cubeName, field, fieldMap)),
    dimensions: dimensions.map((field) => memberName(cubeName, field, fieldMap)),
    filters: query.filters.map((filter) => cubeFilter(cubeName, filter, fieldMap)),
    order: query.order ? { [memberName(cubeName, query.order.field, fieldMap)]: query.order.direction } : undefined,
    limit: query.limit,
  };
}
