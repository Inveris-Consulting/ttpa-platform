import { supabase } from './supabase';

export interface DashboardItem {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'native' | 'powerbi' | 'analytics_kit';
  iframeUrl?: string;
  iconName?: string;
  createdAt: string;
}

export const DEFAULT_DASHBOARDS: DashboardItem[] = [
  {
    id: 'ttpa-team-performance',
    title: 'TTPA Team Performance',
    description: 'Operational analytics dashboard for Calls, Submissions, Deals, and Representative heatmaps connected live to Supabase.',
    category: 'Core Operations',
    type: 'native',
    createdAt: '2026-08-19',
  },
  {
    id: 'ttpa-bonus',
    title: 'TTPA Bonus',
    description: 'Acompanhamento e cálculo de bônus por alunos matriculados para TTPA e Workforce Evolved.',
    category: 'Incentives & Bonus',
    type: 'native',
    createdAt: '2026-08-28',
  },
  {
    id: 'fs-engagement',
    title: 'FS Team Engagement for TTPA Leads',
    description: 'Tracks whether the FS Team is calling leads sent by the TTPA, listing uncalled leads with direct CRM integration.',
    category: 'Core Operations',
    type: 'native',
    createdAt: '2026-08-20',
  },
  {
    id: 'powerbi-sample-executive',
    title: 'Executive Recruitment Overview (Power BI)',
    description: 'Executive summary report embedded directly from Power BI Service for high-level recruiting metrics.',
    category: 'Executive Reports',
    type: 'powerbi',
    iframeUrl: 'https://app.powerbi.com/view?r=eyJrIjoiOGY2MDY5ZDItMjkyNy00NTliLTk5MzEtOGVmY2IwMzIwYzNkIiwidCI6IjljNDAzYTA1LWNmYzQtNGM5OS05NDc3LTkyNmMyODJhZTJhMSJ9',
    createdAt: '2026-08-19',
  }
];

/**
 * Extracts a valid Power BI embed URL from a direct link or HTML iframe string.
 * Example input 1: https://app.powerbi.com/view?r=eyJrIjoi...
 * Example input 2: <iframe title="Veteran Primes Leads" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoi..." frameborder="0" allowFullScreen="true"></iframe>
 */
export const extractIframeUrl = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  
  // Check if HTML iframe tag
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }
  
  return trimmed;
};

/**
 * Fetches all dashboards from Supabase, applying RBAC filtering if user is non-admin.
 */
export const fetchDashboardsFromSupabase = async (
  userId?: string,
  userRole?: string
): Promise<DashboardItem[]> => {
  try {
    const { data: dbDashboards, error } = await supabase
      .from('dashboards')
      .select('*')
      .order('created_at', { ascending: true });

    if (error || !dbDashboards || dbDashboards.length === 0) {
      console.warn('Fallback to DEFAULT_DASHBOARDS due to Supabase query response:', error);
      return DEFAULT_DASHBOARDS;
    }

    const allItems: DashboardItem[] = dbDashboards.map((d: any) => ({
      id: d.id,
      title: d.title,
      description: d.description || '',
      category: d.category || 'Executive Reports',
      type: d.type as 'native' | 'powerbi' | 'analytics_kit',
      iframeUrl: d.iframe_url || undefined,
      createdAt: d.created_at ? new Date(d.created_at).toISOString().split('T')[0] : '2026-08-19',
    }));

    // Admin user gets ALL dashboards
    if (userRole === 'admin') {
      return allItems;
    }

    // Regular user: fetch linked dashboards from user_dashboards
    if (userId && userRole === 'user') {
      const { data: userLinks } = await supabase
        .from('user_dashboards')
        .select('dashboard_id')
        .eq('user_id', userId);

      if (userLinks && userLinks.length > 0) {
        const allowedIds = new Set(userLinks.map((l: any) => l.dashboard_id));
        // Return native dashboards OR dashboards explicitly linked to the user
        return allItems.filter((d) => d.type === 'native' || allowedIds.has(d.id));
      } else {
        // Default to native dashboards if no specific links exist yet
        return allItems.filter((d) => d.type === 'native');
      }
    }

    return allItems;
  } catch (err) {
    console.error('Error fetching dashboards from Supabase:', err);
    return DEFAULT_DASHBOARDS;
  }
};

/**
 * Adds a new Power BI dashboard to Supabase.
 */
export const addPowerBIDashboardSupabase = async (dashboard: {
  title: string;
  description: string;
  category: string;
  iframeUrl: string;
}): Promise<DashboardItem> => {
  const cleanUrl = extractIframeUrl(dashboard.iframeUrl);
  const newId = `pbi-${Date.now()}`;

  const { data, error } = await supabase
    .from('dashboards')
    .insert([
      {
        id: newId,
        title: dashboard.title,
        description: dashboard.description || 'Embedded published Power BI report.',
        category: dashboard.category || 'Executive Reports',
        type: 'powerbi',
        iframe_url: cleanUrl,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    category: data.category || 'Executive Reports',
    type: 'powerbi',
    iframeUrl: data.iframe_url,
    createdAt: new Date().toISOString().split('T')[0],
  };
};

/**
 * Deletes a custom Power BI dashboard from Supabase.
 */
export const deletePowerBIDashboardSupabase = async (dashboardId: string): Promise<void> => {
  const { error } = await supabase.from('dashboards').delete().eq('id', dashboardId);

  if (error) {
    throw error;
  }
};

/**
 * Fetches dashboard IDs currently linked to a specific user.
 */
export const fetchUserDashboardLinks = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_dashboards')
      .select('dashboard_id')
      .eq('user_id', userId);

    if (error || !data) return [];
    return data.map((d: any) => d.dashboard_id);
  } catch (err) {
    console.error('Error fetching user dashboard links:', err);
    return [];
  }
};

/**
 * Saves/syncs the list of linked dashboards for a specific user.
 */
export const saveUserDashboardLinks = async (userId: string, dashboardIds: string[]): Promise<void> => {
  // Delete existing links for user
  const { error: deleteErr } = await supabase.from('user_dashboards').delete().eq('user_id', userId);
  if (deleteErr) throw deleteErr;

  if (dashboardIds.length === 0) return;

  const rowsToInsert = dashboardIds.map((dashId) => ({
    user_id: userId,
    dashboard_id: dashId,
  }));

  const { error: insertErr } = await supabase.from('user_dashboards').insert(rowsToInsert);
  if (insertErr) throw insertErr;
};
