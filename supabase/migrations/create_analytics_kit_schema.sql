-- Migration: Create Analytics Kit Schema and RPC Functions
-- File: supabase/migrations/create_analytics_kit_schema.sql

-- 1. Update check constraint on dashboards table to allow 'analytics_kit'
ALTER TABLE public.dashboards DROP CONSTRAINT IF EXISTS dashboards_type_check;
ALTER TABLE public.dashboards ADD CONSTRAINT dashboards_type_check CHECK (type IN ('native', 'powerbi', 'analytics_kit'));

-- 2. Create Analytics Kit persistence tables
CREATE TABLE IF NOT EXISTS public.analytics_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('chart', 'dashboard')),
  owner_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_charts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  folder_id TEXT REFERENCES public.analytics_folders(id) ON DELETE SET NULL,
  query JSONB NOT NULL,
  visualization JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_dashboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  folder_id TEXT REFERENCES public.analytics_folders(id) ON DELETE SET NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analytics_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id TEXT NOT NULL REFERENCES public.analytics_dashboards(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dashboard_id, user_id)
);

-- 3. Enable RLS
ALTER TABLE public.analytics_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_grants ENABLE ROW LEVEL SECURITY;

-- Clean and recreate policies
DROP POLICY IF EXISTS "Allow all on analytics_folders" ON public.analytics_folders;
CREATE POLICY "Allow all on analytics_folders" ON public.analytics_folders FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on analytics_charts" ON public.analytics_charts;
CREATE POLICY "Allow all on analytics_charts" ON public.analytics_charts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on analytics_dashboards" ON public.analytics_dashboards;
CREATE POLICY "Allow all on analytics_dashboards" ON public.analytics_dashboards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on analytics_grants" ON public.analytics_grants;
CREATE POLICY "Allow all on analytics_grants" ON public.analytics_grants FOR ALL USING (true) WITH CHECK (true);

-- 4. Distinct values RPC function for filter dropdowns
CREATE OR REPLACE FUNCTION public.analytics_distinct_values(
  field_name TEXT,
  search_text TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB := '[]'::jsonb;
  v_search TEXT := COALESCE(search_text, '');
BEGIN
  IF field_name = 'representative' THEN
    SELECT jsonb_agg(DISTINCT val)
    INTO v_result
    FROM (
      SELECT "Representative" AS val
      FROM public."dRepresentatives"
      WHERE "Representative" IS NOT NULL 
        AND ("Representative" ILIKE '%' || v_search || '%')
      ORDER BY "Representative"
      LIMIT 50
    ) t;
  ELSIF field_name = 'form_source' THEN
    SELECT jsonb_agg(DISTINCT val)
    INTO v_result
    FROM (
      SELECT "Form Name" AS val
      FROM public."fSubmissions"
      WHERE "Form Name" IS NOT NULL 
        AND ("Form Name" ILIKE '%' || v_search || '%')
      UNION
      SELECT "Form Name" AS val
      FROM public."dContacts_crm"
      WHERE "Form Name" IS NOT NULL 
        AND ("Form Name" ILIKE '%' || v_search || '%')
      LIMIT 50
    ) t;
  ELSIF field_name = 'direction' THEN
    SELECT jsonb_agg(DISTINCT val)
    INTO v_result
    FROM (
      SELECT DISTINCT direction AS val
      FROM public."fCalls"
      WHERE direction IS NOT NULL
      LIMIT 10
    ) t;
  ELSIF field_name = 'answered' THEN
    v_result := '["true", "false"]'::jsonb;
  END IF;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- 5. Main Analytics Query Engine RPC
CREATE OR REPLACE FUNCTION public.analytics_query(query_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_measures TEXT[];
  requested_dimensions TEXT[];
  v_breakdown TEXT;
  v_limit INT := 25;
  v_order_field TEXT;
  v_order_dir TEXT := 'DESC';
  v_time_granularity TEXT := 'month';
  v_filters JSONB;
  
  v_filter_start DATE := NULL;
  v_filter_end DATE := NULL;
  v_filter_rep TEXT := NULL;
  v_filter_direction TEXT := NULL;
  v_filter_form TEXT := NULL;
  
  elem JSONB;
  f_field TEXT;
  f_op TEXT;
  f_val TEXT;
  
  v_result JSONB := '[]'::jsonb;
BEGIN
  -- Parse measures
  SELECT ARRAY_AGG(value::text)
  INTO requested_measures
  FROM jsonb_array_elements_text(COALESCE(query_payload->'measures', '[]'::jsonb));

  IF requested_measures IS NULL OR array_length(requested_measures, 1) = 0 THEN
    requested_measures := ARRAY['calls'];
  END IF;

  -- Parse dimensions
  SELECT ARRAY_AGG(value::text)
  INTO requested_dimensions
  FROM jsonb_array_elements_text(COALESCE(query_payload->'dimensions', '[]'::jsonb));

  IF requested_dimensions IS NULL THEN
    requested_dimensions := ARRAY[]::TEXT[];
  END IF;

  -- Parse breakdown
  v_breakdown := query_payload->>'breakdown';
  IF v_breakdown IS NOT NULL AND v_breakdown <> '' AND NOT (v_breakdown = ANY(requested_dimensions)) THEN
    requested_dimensions := array_append(requested_dimensions, v_breakdown);
  END IF;

  -- Parse Limit
  IF query_payload->>'limit' IS NOT NULL THEN
    v_limit := LEAST(GREATEST((query_payload->>'limit')::INT, 1), 500);
  END IF;

  -- Parse Order
  IF query_payload->'order' IS NOT NULL THEN
    v_order_field := query_payload->'order'->>'field';
    IF LOWER(query_payload->'order'->>'direction') = 'asc' THEN
      v_order_dir := 'ASC';
    ELSE
      v_order_dir := 'DESC';
    END IF;
  END IF;

  -- Parse Time Granularity
  IF query_payload->>'timeGranularity' IS NOT NULL THEN
    v_time_granularity := query_payload->>'timeGranularity';
  END IF;

  -- Parse filters
  v_filters := query_payload->'filters';
  IF v_filters IS NOT NULL AND jsonb_typeof(v_filters) = 'array' THEN
    FOR elem IN SELECT * FROM jsonb_array_elements(v_filters)
    LOOP
      f_field := elem->>'field';
      f_op := elem->>'operator';
      f_val := elem->>'value';

      IF f_field = 'date' THEN
        IF f_val = 'today' THEN
          v_filter_start := CURRENT_DATE;
          v_filter_end := CURRENT_DATE;
        ELSIF f_val = 'yesterday' THEN
          v_filter_start := CURRENT_DATE - INTERVAL '1 day';
          v_filter_end := CURRENT_DATE - INTERVAL '1 day';
        ELSIF f_val = 'thisWeek' THEN
          v_filter_start := date_trunc('week', CURRENT_DATE)::date;
          v_filter_end := CURRENT_DATE;
        ELSIF f_val = 'previousWeek' THEN
          v_filter_start := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
          v_filter_end := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
        ELSIF f_val = 'thisMonth' THEN
          v_filter_start := date_trunc('month', CURRENT_DATE)::date;
          v_filter_end := CURRENT_DATE;
        ELSIF f_val = 'previousMonth' THEN
          v_filter_start := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date;
          v_filter_end := (date_trunc('month', CURRENT_DATE) - INTERVAL '1 day')::date;
        ELSIF f_val = 'thisYear' THEN
          v_filter_start := date_trunc('year', CURRENT_DATE)::date;
          v_filter_end := CURRENT_DATE;
        ELSIF f_val = 'previousYear' THEN
          v_filter_start := (date_trunc('year', CURRENT_DATE) - INTERVAL '1 year')::date;
          v_filter_end := (date_trunc('year', CURRENT_DATE) - INTERVAL '1 day')::date;
        END IF;
      ELSIF f_field = 'representative' AND f_val IS NOT NULL AND f_val <> '' THEN
        v_filter_rep := f_val;
      ELSIF f_field = 'direction' AND f_val IS NOT NULL AND f_val <> '' THEN
        v_filter_direction := f_val;
      ELSIF f_field = 'form_source' AND f_val IS NOT NULL AND f_val <> '' THEN
        v_filter_form := f_val;
      END IF;
    END LOOP;
  END IF;

  IF v_filter_start IS NULL THEN
    v_filter_start := (CURRENT_DATE - INTERVAL '120 days')::date;
  END IF;
  IF v_filter_end IS NULL THEN
    v_filter_end := CURRENT_DATE;
  END IF;

  WITH 
    calls_grouped AS (
      SELECT 
        CASE 
          WHEN 'date' = ANY(requested_dimensions) THEN
            CASE 
              WHEN v_time_granularity = 'day' THEN to_char(c."Date", 'YYYY-MM-DD')
              WHEN v_time_granularity = 'week' THEN 'W' || to_char(c."Date", 'WW/YYYY')
              WHEN v_time_granularity = 'year' THEN to_char(c."Date", 'YYYY')
              ELSE to_char(c."Date", 'YYYY-MM')
            END
          ELSE 'All Time'
        END AS grp_date,
        CASE WHEN 'representative' = ANY(requested_dimensions) THEN COALESCE(r."Representative", c."Representative", 'Unassigned') ELSE 'All Reps' END AS grp_rep,
        CASE WHEN 'direction' = ANY(requested_dimensions) THEN COALESCE(c.direction, 'Unknown') ELSE 'All Directions' END AS grp_dir,
        CASE WHEN 'form_source' = ANY(requested_dimensions) THEN COALESCE(ct."Form Name", 'Direct/Other') ELSE 'All Forms' END AS grp_form,
        CASE WHEN 'answered' = ANY(requested_dimensions) THEN c.answered::text ELSE 'All' END AS grp_ans,
        COUNT(*) AS calls_count,
        COUNT(*) FILTER (WHERE c.answered = true) AS answered_calls_count,
        ROUND(COALESCE(AVG(COALESCE(c."duration (in call)", c."duration (total)", 0)) FILTER (WHERE c.answered = true), 0)) AS avg_dur
      FROM public."fCalls" c
      LEFT JOIN public."dRepresentatives" r ON c.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
      WHERE c."Date" >= v_filter_start AND c."Date" <= v_filter_end
        AND (v_filter_rep IS NULL OR COALESCE(r."Representative", c."Representative") = v_filter_rep)
        AND (v_filter_direction IS NULL OR c.direction = v_filter_direction)
        AND (v_filter_form IS NULL OR ct."Form Name" ILIKE '%' || v_filter_form || '%')
      GROUP BY 1, 2, 3, 4, 5
    ),
    submissions_grouped AS (
      SELECT 
        CASE 
          WHEN 'date' = ANY(requested_dimensions) THEN
            CASE 
              WHEN v_time_granularity = 'day' THEN to_char(s."Date", 'YYYY-MM-DD')
              WHEN v_time_granularity = 'week' THEN 'W' || to_char(s."Date", 'WW/YYYY')
              WHEN v_time_granularity = 'year' THEN to_char(s."Date", 'YYYY')
              ELSE to_char(s."Date", 'YYYY-MM')
            END
          ELSE 'All Time'
        END AS grp_date,
        CASE WHEN 'representative' = ANY(requested_dimensions) THEN COALESCE(r."Representative", s."Representative", 'Unassigned') ELSE 'All Reps' END AS grp_rep,
        CASE WHEN 'form_source' = ANY(requested_dimensions) THEN COALESCE(s."Form Name", 'Direct/Other') ELSE 'All Forms' END AS grp_form,
        COUNT(*) AS subs_count
      FROM public."fSubmissions" s
      LEFT JOIN public."dRepresentatives" r ON s.representative_id = r.id
      WHERE s."Date" >= v_filter_start AND s."Date" <= v_filter_end
        AND (v_filter_rep IS NULL OR COALESCE(r."Representative", s."Representative") = v_filter_rep)
        AND (v_filter_form IS NULL OR s."Form Name" ILIKE '%' || v_filter_form || '%')
      GROUP BY 1, 2, 3
    ),
    deals_grouped AS (
      SELECT 
        CASE 
          WHEN 'date' = ANY(requested_dimensions) THEN
            CASE 
              WHEN v_time_granularity = 'day' THEN to_char(d."Date", 'YYYY-MM-DD')
              WHEN v_time_granularity = 'week' THEN 'W' || to_char(d."Date", 'WW/YYYY')
              WHEN v_time_granularity = 'year' THEN to_char(d."Date", 'YYYY')
              ELSE to_char(d."Date", 'YYYY-MM')
            END
          ELSE 'All Time'
        END AS grp_date,
        CASE WHEN 'representative' = ANY(requested_dimensions) THEN COALESCE(r."Representative", 'Unassigned') ELSE 'All Reps' END AS grp_rep,
        COUNT(*) AS deals_count
      FROM public."fDeals" d
      LEFT JOIN public."dRepresentatives" r ON d.representative_id = r.id
      WHERE d."Date" >= v_filter_start AND d."Date" <= v_filter_end
        AND (v_filter_rep IS NULL OR r."Representative" = v_filter_rep)
      GROUP BY 1, 2
    ),
    students_grouped AS (
      SELECT 
        CASE 
          WHEN 'date' = ANY(requested_dimensions) THEN
            CASE 
              WHEN v_time_granularity = 'day' THEN to_char(st."Date", 'YYYY-MM-DD')
              WHEN v_time_granularity = 'week' THEN 'W' || to_char(st."Date", 'WW/YYYY')
              WHEN v_time_granularity = 'year' THEN to_char(st."Date", 'YYYY')
              ELSE to_char(st."Date", 'YYYY-MM')
            END
          ELSE 'All Time'
        END AS grp_date,
        CASE WHEN 'representative' = ANY(requested_dimensions) THEN COALESCE(r."Representative", 'Unassigned') ELSE 'All Reps' END AS grp_rep,
        COUNT(*) AS students_count
      FROM public."fStudents" st
      LEFT JOIN public."dRepresentatives" r ON st.representative_id = r.id
      WHERE st."Date" >= v_filter_start AND st."Date" <= v_filter_end
        AND (v_filter_rep IS NULL OR r."Representative" = v_filter_rep)
      GROUP BY 1, 2
    )
  SELECT jsonb_agg(to_jsonb(res))
  INTO v_result
  FROM (
    SELECT 
      CASE WHEN 'date' = ANY(requested_dimensions) THEN c.grp_date ELSE NULL END AS "date",
      CASE WHEN 'representative' = ANY(requested_dimensions) THEN c.grp_rep ELSE NULL END AS "representative",
      CASE WHEN 'direction' = ANY(requested_dimensions) THEN c.grp_dir ELSE NULL END AS "direction",
      CASE WHEN 'form_source' = ANY(requested_dimensions) THEN c.grp_form ELSE NULL END AS "form_source",
      CASE WHEN 'answered' = ANY(requested_dimensions) THEN c.grp_ans ELSE NULL END AS "answered",
      
      -- Measures
      c.calls_count AS calls,
      c.answered_calls_count AS answered_calls,
      COALESCE(sub.subs_count, 0) AS submissions,
      COALESCE(dl.deals_count, 0) AS deals,
      COALESCE(std.students_count, 0) AS students,
      c.avg_dur AS avg_duration,
      CASE 
        WHEN c.calls_count > 0 THEN 
          ROUND((COALESCE(sub.subs_count, 0)::numeric / c.calls_count::numeric) * 100, 1)
        ELSE 0 
      END AS submission_rate,
      CASE 
        WHEN COALESCE(sub.subs_count, 0) > 0 THEN 
          ROUND((COALESCE(dl.deals_count, 0)::numeric / sub.subs_count::numeric) * 100, 1)
        ELSE 0 
      END AS deal_rate
    FROM calls_grouped c
    LEFT JOIN submissions_grouped sub ON c.grp_date = sub.grp_date AND c.grp_rep = sub.grp_rep AND ('form_source' <> ALL(requested_dimensions) OR c.grp_form = sub.grp_form)
    LEFT JOIN deals_grouped dl ON c.grp_date = dl.grp_date AND c.grp_rep = dl.grp_rep
    LEFT JOIN students_grouped std ON c.grp_date = std.grp_date AND c.grp_rep = std.grp_rep
    ORDER BY c.calls_count DESC
    LIMIT v_limit
  ) res;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
