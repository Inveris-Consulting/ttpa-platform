import { SupabaseClient } from '@supabase/supabase-js';
import type {
  AnalyticsKitRepository,
  DashboardGrant,
  KitDashboard,
  KitFolder,
  KitFolderKind,
  SavedKitChart,
} from '../types';

export function createSupabaseRepository(supabase: SupabaseClient): AnalyticsKitRepository {
  return {
    async listCharts(): Promise<SavedKitChart[]> {
      const { data, error } = await supabase
        .from('analytics_charts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error listing analytics charts:', error);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        folderId: row.folder_id || undefined,
        query: row.query,
        visualization: row.visualization,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async saveChart(chart: SavedKitChart): Promise<SavedKitChart> {
      const now = new Date().toISOString();
      const payload = {
        id: chart.id,
        name: chart.name,
        owner_id: chart.ownerId || null,
        folder_id: chart.folderId || null,
        query: chart.query,
        visualization: chart.visualization,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('analytics_charts')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        ownerId: data.owner_id,
        folderId: data.folder_id || undefined,
        query: data.query,
        visualization: data.visualization,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },

    async deleteChart(id: string): Promise<void> {
      const { error } = await supabase.from('analytics_charts').delete().eq('id', id);
      if (error) throw error;
    },

    async listDashboards(): Promise<KitDashboard[]> {
      const { data, error } = await supabase
        .from('analytics_dashboards')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error listing analytics dashboards:', error);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description || '',
        ownerId: row.owner_id || 'system',
        folderId: row.folder_id || undefined,
        items: Array.isArray(row.items) ? row.items : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async saveDashboard(dashboard: KitDashboard): Promise<KitDashboard> {
      const now = new Date().toISOString();
      const payload = {
        id: dashboard.id,
        name: dashboard.name,
        description: dashboard.description || '',
        owner_id: dashboard.ownerId || null,
        folder_id: dashboard.folderId || null,
        items: dashboard.items,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('analytics_dashboards')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      // Sync with global TTPA dashboards catalog table
      try {
        await supabase.from('dashboards').upsert({
          id: dashboard.id,
          title: dashboard.name,
          description: dashboard.description || 'Interactive dashboard built with Analytics Kit.',
          category: 'Custom Analytics',
          type: 'analytics_kit',
          created_at: data.created_at,
        });
      } catch (syncErr) {
        console.warn('Could not sync with dashboards table:', syncErr);
      }

      return {
        id: data.id,
        name: data.name,
        description: data.description || '',
        ownerId: data.owner_id,
        folderId: data.folder_id || undefined,
        items: Array.isArray(data.items) ? data.items : [],
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },

    async deleteDashboard(id: string): Promise<void> {
      const { error } = await supabase.from('analytics_dashboards').delete().eq('id', id);
      if (error) throw error;

      // Remove from global TTPA dashboards table
      try {
        await supabase.from('dashboards').delete().eq('id', id);
      } catch (syncErr) {
        console.warn('Could not delete from dashboards table:', syncErr);
      }
    },

    async listFolders(kind?: KitFolderKind): Promise<KitFolder[]> {
      let query = supabase.from('analytics_folders').select('*').order('name', { ascending: true });
      if (kind) {
        query = query.eq('kind', kind);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error listing analytics folders:', error);
        return [];
      }

      return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        ownerId: row.owner_id || 'system',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    },

    async saveFolder(folder: KitFolder): Promise<KitFolder> {
      const now = new Date().toISOString();
      const payload = {
        id: folder.id,
        name: folder.name,
        kind: folder.kind,
        owner_id: folder.ownerId || null,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('analytics_folders')
        .upsert(payload)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        kind: data.kind,
        ownerId: data.owner_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    },

    async deleteFolder(id: string): Promise<void> {
      const { error } = await supabase.from('analytics_folders').delete().eq('id', id);
      if (error) throw error;
    },

    async listGrants(dashboardId: string): Promise<DashboardGrant[]> {
      const { data, error } = await supabase
        .from('analytics_grants')
        .select('*')
        .eq('dashboard_id', dashboardId);

      if (error) {
        console.error('Error listing grants:', error);
        return [];
      }

      return (data || []).map((row) => ({
        dashboardId: row.dashboard_id,
        userId: row.user_id,
        permission: row.permission,
      }));
    },

    async saveGrant(grant: DashboardGrant): Promise<DashboardGrant> {
      const payload = {
        dashboard_id: grant.dashboardId,
        user_id: grant.userId,
        permission: grant.permission,
      };

      const { data, error } = await supabase
        .from('analytics_grants')
        .upsert(payload, { onConflict: 'dashboard_id,user_id' })
        .select()
        .single();

      if (error) throw error;

      // Sync with user_dashboards for general catalog RBAC
      try {
        await supabase.from('user_dashboards').upsert({
          user_id: grant.userId,
          dashboard_id: grant.dashboardId,
        }, { onConflict: 'user_id,dashboard_id' });
      } catch (syncErr) {
        console.warn('Could not sync user_dashboards grant:', syncErr);
      }

      return {
        dashboardId: data.dashboard_id,
        userId: data.user_id,
        permission: data.permission,
      };
    },

    async deleteGrant(dashboardId: string, userId: string): Promise<void> {
      const { error } = await supabase
        .from('analytics_grants')
        .delete()
        .eq('dashboard_id', dashboardId)
        .eq('user_id', userId);

      if (error) throw error;

      // Sync deletion from user_dashboards
      try {
        await supabase
          .from('user_dashboards')
          .delete()
          .eq('dashboard_id', dashboardId)
          .eq('user_id', userId);
      } catch (syncErr) {
        console.warn('Could not delete from user_dashboards:', syncErr);
      }
    },
  };
}
