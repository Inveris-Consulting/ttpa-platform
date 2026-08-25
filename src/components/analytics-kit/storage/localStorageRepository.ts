import type { AnalyticsKitRepository, DashboardGrant, KitDashboard, KitFolder, SavedKitChart } from '../types';

interface StoredKitState { charts: SavedKitChart[]; dashboards: KitDashboard[]; folders: KitFolder[]; grants: DashboardGrant[] }
const emptyState = (): StoredKitState => ({ charts: [], dashboards: [], folders: [], grants: [] });

export function createLocalStorageRepository(namespace = 'analytics-kit'): AnalyticsKitRepository {
  const key = `${namespace}.state.v1`;
  const read = (): StoredKitState => {
    try { return { ...emptyState(), ...JSON.parse(localStorage.getItem(key) ?? '{}') as StoredKitState }; }
    catch { return emptyState(); }
  };
  const write = (state: StoredKitState) => localStorage.setItem(key, JSON.stringify(state));
  return {
    async listCharts() { return read().charts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveChart(chart) { const state = read(), index = state.charts.findIndex((item) => item.id === chart.id); if (index >= 0) state.charts[index] = chart; else state.charts.push(chart); write(state); return chart; },
    async deleteChart(id) { const state = read(); state.charts = state.charts.filter((item) => item.id !== id); write(state); },
    async listDashboards() { return read().dashboards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); },
    async saveDashboard(dashboard) { const state = read(), index = state.dashboards.findIndex((item) => item.id === dashboard.id); if (index >= 0) state.dashboards[index] = dashboard; else state.dashboards.push(dashboard); write(state); return dashboard; },
    async deleteDashboard(id) { const state = read(); state.dashboards = state.dashboards.filter((item) => item.id !== id); state.grants = state.grants.filter((item) => item.dashboardId !== id); write(state); },
    async listFolders(kind) { return read().folders.filter((item) => !kind || item.kind === kind).sort((a, b) => a.name.localeCompare(b.name)); },
    async saveFolder(folder) { const state = read(), index = state.folders.findIndex((item) => item.id === folder.id); if (index >= 0) state.folders[index] = folder; else state.folders.push(folder); write(state); return folder; },
    async deleteFolder(id) { const state = read(); state.folders = state.folders.filter((item) => item.id !== id); state.charts = state.charts.map((item) => item.folderId === id ? { ...item, folderId: undefined } : item); state.dashboards = state.dashboards.map((item) => item.folderId === id ? { ...item, folderId: undefined } : item); write(state); },
    async listGrants(dashboardId) { return read().grants.filter((item) => item.dashboardId === dashboardId); },
    async saveGrant(grant) { const state = read(), index = state.grants.findIndex((item) => item.dashboardId === grant.dashboardId && item.userId === grant.userId); if (index >= 0) state.grants[index] = grant; else state.grants.push(grant); write(state); return grant; },
    async deleteGrant(dashboardId, userId) { const state = read(); state.grants = state.grants.filter((item) => item.dashboardId !== dashboardId || item.userId !== userId); write(state); },
  };
}
