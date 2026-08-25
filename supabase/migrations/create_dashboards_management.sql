-- Migration: Create Dashboard Management and User Access Tables with RLS Policies
-- File: supabase/migrations/create_dashboards_management.sql

CREATE TABLE IF NOT EXISTS public.dashboards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Executive Reports',
  type TEXT NOT NULL CHECK (type IN ('native', 'powerbi')),
  iframe_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dashboard_id TEXT NOT NULL REFERENCES public.dashboards(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, dashboard_id)
);

-- MANDATORY SECURITY DIRECTIVE: Always enable RLS on all tables
ALTER TABLE public.dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_dashboards ENABLE ROW LEVEL SECURITY;

-- Clean up existing policies
DROP POLICY IF EXISTS "Allow read access on dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Allow insert access on dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Allow update access on dashboards" ON public.dashboards;
DROP POLICY IF EXISTS "Allow delete access on dashboards" ON public.dashboards;

DROP POLICY IF EXISTS "Allow read access on user_dashboards" ON public.user_dashboards;
DROP POLICY IF EXISTS "Allow insert access on user_dashboards" ON public.user_dashboards;
DROP POLICY IF EXISTS "Allow update access on user_dashboards" ON public.user_dashboards;
DROP POLICY IF EXISTS "Allow delete access on user_dashboards" ON public.user_dashboards;

-- Create explicit RLS policies for dashboards
CREATE POLICY "Allow read access on dashboards" ON public.dashboards FOR SELECT USING (true);
CREATE POLICY "Allow insert access on dashboards" ON public.dashboards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access on dashboards" ON public.dashboards FOR UPDATE USING (true);
CREATE POLICY "Allow delete access on dashboards" ON public.dashboards FOR DELETE USING (true);

-- Create explicit RLS policies for user_dashboards
CREATE POLICY "Allow read access on user_dashboards" ON public.user_dashboards FOR SELECT USING (true);
CREATE POLICY "Allow insert access on user_dashboards" ON public.user_dashboards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access on user_dashboards" ON public.user_dashboards FOR UPDATE USING (true);
CREATE POLICY "Allow delete access on user_dashboards" ON public.user_dashboards FOR DELETE USING (true);

INSERT INTO public.dashboards (id, title, description, category, type, iframe_url)
VALUES 
(
  'ttpa-team-performance',
  'TTPA Team Performance',
  'Operational analytics dashboard for Calls, Submissions, Deals, and Representative heatmaps connected live to Supabase.',
  'Core Operations',
  'native',
  NULL
),
(
  'fs-engagement',
  'FS Team Engagement for TTPA Leads',
  'Tracks whether the FS Team is calling leads sent by the TTPA, listing uncalled leads with direct CRM integration.',
  'Core Operations',
  'native',
  NULL
),
(
  'powerbi-sample-executive',
  'Executive Recruitment Overview (Power BI)',
  'Executive summary report embedded directly from Power BI Service for high-level recruiting metrics.',
  'Executive Reports',
  'powerbi',
  'https://app.powerbi.com/view?r=eyJrIjoiOGY2MDY5ZDItMjkyNy00NTliLTk5MzEtOGVmY2IwMzIwYzNkIiwidCI6IjljNDAzYTA1LWNmYzQtNGM5OS05NDc3LTkyNmMyODJhZTJhMSJ9'
)
ON CONFLICT (id) DO UPDATE SET 
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  type = EXCLUDED.type,
  iframe_url = EXCLUDED.iframe_url;
