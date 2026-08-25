-- Migration: Create TTPA and FS Team Analytical RPC Functions
-- File: supabase/migrations/create_dashboard_views.sql

-- ===========================================================================
-- FUNCTION 1: get_ttpa_performance_kpis
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_ttpa_performance_kpis(
  p_start_date DATE,
  p_end_date DATE,
  p_representative TEXT DEFAULT 'All Representatives',
  p_form_name TEXT DEFAULT 'All Forms'
)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE := p_start_date;
  v_end_date DATE := p_end_date;
  v_result JSON;
BEGIN
  IF v_start_date IS NULL THEN
    v_start_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
  END IF;
  IF v_end_date IS NULL THEN
    v_end_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
  END IF;

  WITH 
    filtered_reps AS (
      SELECT id, "Representative"
      FROM public."dRepresentatives"
      WHERE "Type" = 'TTPA'
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR "Representative" = p_representative)
    ),

    calls_base AS (
      SELECT c.*
      FROM public."fCalls" c
      JOIN filtered_reps r ON c.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
      WHERE c."Date" >= v_start_date AND c."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name)
    ),

    submissions_base AS (
      SELECT s.*
      FROM public."fSubmissions" s
      JOIN filtered_reps r ON s.representative_id = r.id
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email"))
           OR (s."Contact ID" IS NOT NULL AND s."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      WHERE s."Date" >= v_start_date AND s."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR s."Form Name" = p_form_name OR ct."Form Name" = p_form_name)
    ),

    deals_base AS (
      SELECT d.*
      FROM public."fDeals" d
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (d."Email" IS NOT NULL AND d."Email" != '' AND LOWER(d."Email") = LOWER(ct."Email"))
           OR (d."Contact ID" IS NOT NULL AND d."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN d."Email" IS NOT NULL AND d."Email" != '' AND LOWER(d."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN public."fSubmissions" sub ON d."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r ON COALESCE(d.representative_id, ct.representative_id, sub.representative_id) = r.id
      WHERE d."Date" >= v_start_date AND d."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name OR sub."Form Name" = p_form_name)
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR r."Representative" = p_representative)
    ),

    students_base AS (
      SELECT st.*
      FROM public."fStudents" st
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (st."Email" IS NOT NULL AND st."Email" != '' AND LOWER(st."Email") = LOWER(ct."Email"))
           OR (st."Contact ID" IS NOT NULL AND st."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN st."Email" IS NOT NULL AND st."Email" != '' AND LOWER(st."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN public."fSubmissions" sub ON st."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r ON COALESCE(st.representative_id, ct.representative_id, sub.representative_id) = r.id
      WHERE st."Date" >= v_start_date AND st."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name OR sub."Form Name" = p_form_name)
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR r."Representative" = p_representative)
    ),

    days_span AS (
      SELECT NULLIF((v_end_date - v_start_date) + 1, 0) AS days_count
    ),

    raw_counts AS (
      SELECT 
        (SELECT COUNT(*) FROM calls_base) AS calls_count,
        (SELECT COUNT(*) FROM submissions_base) AS submissions_count,
        (SELECT COUNT(*) FROM deals_base) AS deals_count,
        (SELECT COUNT(*) FROM students_base) AS students_count,
        COALESCE(NULLIF((SELECT COUNT(DISTINCT representative_id) FROM calls_base), 0), 1) AS active_calls_reps,
        COALESCE(NULLIF((SELECT COUNT(DISTINCT representative_id) FROM submissions_base), 0), 1) AS active_sub_reps,
        (SELECT COALESCE(ROUND(AVG(COALESCE(c."duration (in call)", c."duration (total)", 0))), 0) FROM calls_base c WHERE c."answered" = true) AS avg_talk_time
    )

  SELECT json_build_object(
    'calls', k.calls_count,
    'submissions', k.submissions_count,
    'deals', k.deals_count,
    'students', k.students_count,
    'submission_rate', CASE WHEN k.calls_count > 0 THEN ROUND((k.submissions_count::numeric / k.calls_count::numeric) * 100, 1) ELSE 0 END,
    'deals_rate', CASE WHEN k.submissions_count > 0 THEN ROUND((k.deals_count::numeric / k.submissions_count::numeric) * 100, 1) ELSE 0 END,
    'students_rate', CASE WHEN k.submissions_count > 0 THEN ROUND((k.students_count::numeric / k.submissions_count::numeric) * 100, 1) ELSE 0 END,
    'avg_talk_time', k.avg_talk_time,
    'calls_per_rep', ROUND(k.calls_count::numeric / k.active_calls_reps::numeric, 1),
    'avg_daily_calls', ROUND(k.calls_count::numeric / (SELECT days_count FROM days_span)::numeric, 1),
    'avg_daily_calls_per_rep', ROUND((k.calls_count::numeric / k.active_calls_reps::numeric) / (SELECT days_count FROM days_span)::numeric, 1),
    'submissions_per_rep', ROUND(k.submissions_count::numeric / k.active_sub_reps::numeric, 1),
    'avg_daily_submissions', ROUND(k.submissions_count::numeric / (SELECT days_count FROM days_span)::numeric, 1),
    'avg_daily_submissions_per_rep', ROUND((k.submissions_count::numeric / k.active_sub_reps::numeric) / (SELECT days_count FROM days_span)::numeric, 1),
    'students_rate_vs_deals', CASE WHEN k.deals_count > 0 THEN ROUND((k.students_count::numeric / k.deals_count::numeric) * 100, 1) ELSE 0 END
  ) INTO v_result
  FROM raw_counts k;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================================================
-- FUNCTION 2: get_ttpa_performance_charts
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_ttpa_performance_charts(
  p_start_date DATE,
  p_end_date DATE,
  p_representative TEXT DEFAULT 'All Representatives',
  p_form_name TEXT DEFAULT 'All Forms',
  p_kpi_type TEXT DEFAULT 'submissions',
  p_granularity TEXT DEFAULT 'day'
)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE := p_start_date;
  v_end_date DATE := p_end_date;
  v_result JSON;
BEGIN
  IF v_start_date IS NULL THEN
    v_start_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
  END IF;
  IF v_end_date IS NULL THEN
    v_end_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
  END IF;

  WITH 
    filtered_reps AS (
      SELECT id, "Representative"
      FROM public."dRepresentatives"
      WHERE "Type" = 'TTPA'
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR "Representative" = p_representative)
    ),

    unified_facts AS (
      -- Calls
      SELECT 
        'calls' AS kpi,
        c."Date" AS event_date,
        c."Hour" AS hour_num,
        r."Representative" AS rep_name,
        COALESCE(ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        c."duration (in call)" AS duration_in_call,
        c."duration (total)" AS duration_total,
        c."answered"
      FROM public."fCalls" c
      JOIN filtered_reps r ON c.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
      WHERE c."Date" >= v_start_date AND c."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name)
      
      UNION ALL
      
      -- Submissions
      SELECT 
        'submissions' AS kpi,
        s."Date" AS event_date,
        s."Hour" AS hour_num,
        r."Representative" AS rep_name,
        COALESCE(s."Form Name", ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        0 AS duration_in_call, 0 AS duration_total, true AS answered
      FROM public."fSubmissions" s
      JOIN filtered_reps r ON s.representative_id = r.id
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email"))
           OR (s."Contact ID" IS NOT NULL AND s."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      WHERE s."Date" >= v_start_date AND s."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR s."Form Name" = p_form_name OR ct."Form Name" = p_form_name)
      
      UNION ALL
      
      -- Deals
      SELECT 
        'deals' AS kpi,
        d."Date" AS event_date,
        d."Hour" AS hour_num,
        COALESCE(r."Representative", 'Unassigned') AS rep_name,
        COALESCE(ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        0 AS duration_in_call, 0 AS duration_total, true AS answered
      FROM public."fDeals" d
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (d."Email" IS NOT NULL AND d."Email" != '' AND LOWER(d."Email") = LOWER(ct."Email"))
           OR (d."Contact ID" IS NOT NULL AND d."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN d."Email" IS NOT NULL AND d."Email" != '' AND LOWER(d."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN public."fSubmissions" sub ON d."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r ON COALESCE(d.representative_id, ct.representative_id, sub.representative_id) = r.id
      WHERE d."Date" >= v_start_date AND d."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name OR sub."Form Name" = p_form_name)
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR r."Representative" = p_representative)

      UNION ALL

      -- Students
      SELECT 
        'students' AS kpi,
        st."Date" AS event_date,
        st."Hour" AS hour_num,
        COALESCE(r."Representative", 'Unassigned') AS rep_name,
        COALESCE(ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        0 AS duration_in_call, 0 AS duration_total, true AS answered
      FROM public."fStudents" st
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (st."Email" IS NOT NULL AND st."Email" != '' AND LOWER(st."Email") = LOWER(ct."Email"))
           OR (st."Contact ID" IS NOT NULL AND st."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN st."Email" IS NOT NULL AND st."Email" != '' AND LOWER(st."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN public."fSubmissions" sub ON st."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r ON COALESCE(st.representative_id, ct.representative_id, sub.representative_id) = r.id
      WHERE st."Date" >= v_start_date AND st."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name OR sub."Form Name" = p_form_name)
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR r."Representative" = p_representative)
    ),

    selected_base AS (
      SELECT * FROM unified_facts WHERE kpi = p_kpi_type
    ),

    kpi_by_date AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT 
          CASE 
            WHEN p_granularity = 'week' THEN 'W' || to_char(date_trunc('week', event_date), 'IW (DD/MM)')
            WHEN p_granularity = 'month' THEN to_char(event_date, 'Mon YYYY')
            ELSE to_char(event_date, 'DD/MM/YYYY')
          END AS date,
          COUNT(*) AS value
        FROM selected_base
        GROUP BY 1, 
          CASE 
            WHEN p_granularity = 'week' THEN date_trunc('week', event_date)
            WHEN p_granularity = 'month' THEN date_trunc('month', event_date)
            ELSE date_trunc('day', event_date)
          END
        ORDER BY 
          CASE 
            WHEN p_granularity = 'week' THEN date_trunc('week', event_date)
            WHEN p_granularity = 'month' THEN date_trunc('month', event_date)
            ELSE date_trunc('day', event_date)
          END ASC
      ) t
    ),

    kpi_by_rep AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (SELECT rep_name AS name, COUNT(*) AS value FROM selected_base GROUP BY rep_name ORDER BY value DESC) t
    ),

    kpi_by_form AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (SELECT form_name AS label, COUNT(*) AS value FROM selected_base GROUP BY form_name ORDER BY value DESC) t
    ),

    kpi_by_weekday AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT trim(to_char(event_date, 'Day')) AS label,
               ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT event_date), 0)::numeric, 1) AS value
        FROM selected_base
        GROUP BY label, EXTRACT(ISODOW FROM event_date)
        ORDER BY EXTRACT(ISODOW FROM event_date) ASC
      ) t
    ),

    kpi_by_hour AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        WITH hours_grid AS (
          SELECT to_char(event_date, 'Day') AS day_name,
                 EXTRACT(ISODOW FROM event_date) AS day_num,
                 hour_num,
                 COUNT(*) AS cnt
          FROM selected_base
          GROUP BY day_name, day_num, hour_num
        )
        SELECT trim(day_name) AS day,
          json_build_object(
            '9', COALESCE(SUM(CASE WHEN hour_num = 9 THEN cnt END), 0),
            '10', COALESCE(SUM(CASE WHEN hour_num = 10 THEN cnt END), 0),
            '11', COALESCE(SUM(CASE WHEN hour_num = 11 THEN cnt END), 0),
            '12', COALESCE(SUM(CASE WHEN hour_num = 12 THEN cnt END), 0),
            '13', COALESCE(SUM(CASE WHEN hour_num = 13 THEN cnt END), 0),
            '14', COALESCE(SUM(CASE WHEN hour_num = 14 THEN cnt END), 0),
            '15', COALESCE(SUM(CASE WHEN hour_num = 15 THEN cnt END), 0),
            '16', COALESCE(SUM(CASE WHEN hour_num = 16 THEN cnt END), 0),
            '17', COALESCE(SUM(CASE WHEN hour_num = 17 THEN cnt END), 0),
            '18', COALESCE(SUM(CASE WHEN hour_num = 18 THEN cnt END), 0),
            '19', COALESCE(SUM(CASE WHEN hour_num = 19 THEN cnt END), 0),
            '20', COALESCE(SUM(CASE WHEN hour_num = 20 THEN cnt END), 0),
            '21', COALESCE(SUM(CASE WHEN hour_num = 21 THEN cnt END), 0)
          ) AS hours,
          SUM(cnt) AS total
        FROM hours_grid
        GROUP BY day_name, day_num
        ORDER BY day_num ASC
      ) t
    ),

    call_duration_dist AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT class_label AS label, cnt AS count,
          ROUND((cnt::numeric / NULLIF((SELECT COUNT(*) FROM unified_facts WHERE kpi = 'calls'), 0)::numeric) * 100, 1)::text || '%' AS percentage,
          color
        FROM (
          SELECT 
            CASE 
              WHEN answered = false OR COALESCE(duration_in_call, duration_total, 0) = 0 THEN 'No answer calls'
              WHEN COALESCE(duration_in_call, duration_total, 0) < 10 THEN '-10s Calls'
              WHEN COALESCE(duration_in_call, duration_total, 0) BETWEEN 10 AND 29 THEN '+10s Calls'
              WHEN COALESCE(duration_in_call, duration_total, 0) BETWEEN 30 AND 59 THEN '+30s Calls'
              ELSE '+1min Calls'
            END AS class_label,
            CASE 
              WHEN answered = false OR COALESCE(duration_in_call, duration_total, 0) = 0 THEN '#1E293B'
              WHEN COALESCE(duration_in_call, duration_total, 0) < 10 THEN '#94A3B8'
              WHEN COALESCE(duration_in_call, duration_total, 0) BETWEEN 10 AND 29 THEN '#2563EB'
              WHEN COALESCE(duration_in_call, duration_total, 0) BETWEEN 30 AND 59 THEN '#F59E0B'
              ELSE '#10B981'
            END AS color,
            COUNT(*) AS cnt
          FROM unified_facts WHERE kpi = 'calls'
          GROUP BY class_label, color ORDER BY cnt DESC
        ) sub
      ) t
    ),

    avg_talk_time_by_rep AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (SELECT rep_name AS name, COALESCE(ROUND(AVG(COALESCE(duration_in_call, duration_total, 0))), 0) AS value FROM unified_facts WHERE kpi = 'calls' AND answered = true GROUP BY rep_name ORDER BY value DESC) t
    ),

    calls_funnel AS (
      SELECT json_build_object(
        'total_calls', total, 'answered_calls', answered, 'productive_calls', productive
      ) AS data
      FROM (
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN answered = true THEN 1 ELSE 0 END) AS answered,
          SUM(CASE WHEN answered = true AND COALESCE(duration_in_call, duration_total, 0) >= 30 THEN 1 ELSE 0 END) AS productive
        FROM unified_facts WHERE kpi = 'calls'
      ) t
    ),

    students_by_rep AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (SELECT rep_name AS label, COUNT(*) AS value FROM unified_facts WHERE kpi = 'students' GROUP BY rep_name ORDER BY value DESC) t
    ),

    sources_metrics AS (
      SELECT json_build_object(
        'submissions', (SELECT COALESCE(json_agg(s), '[]'::json) FROM (SELECT source AS label, COUNT(*) AS value FROM unified_facts WHERE kpi = 'submissions' GROUP BY source ORDER BY value DESC) s),
        'deals', (SELECT COALESCE(json_agg(d), '[]'::json) FROM (SELECT source AS label, COUNT(*) AS value FROM unified_facts WHERE kpi = 'deals' GROUP BY source ORDER BY value DESC) d),
        'students', (SELECT COALESCE(json_agg(st), '[]'::json) FROM (SELECT source AS label, COUNT(*) AS value FROM unified_facts WHERE kpi = 'students' GROUP BY source ORDER BY value DESC) st)
      ) AS data
    )

  SELECT json_build_object(
    'kpi_by_date', kd.data, 'kpi_by_rep', kr.data, 'kpi_by_form', kf.data,
    'kpi_by_weekday', kw.data, 'kpi_by_hour', kh.data,
    'call_duration_distribution', cdd.data, 'avg_talk_time_by_rep', attr.data,
    'calls_funnel', cf.data, 'students_by_rep', sr.data, 'sources', sm.data
  ) INTO v_result
  FROM kpi_by_date kd
  CROSS JOIN kpi_by_rep kr CROSS JOIN kpi_by_form kf
  CROSS JOIN kpi_by_weekday kw CROSS JOIN kpi_by_hour kh
  CROSS JOIN call_duration_dist cdd CROSS JOIN avg_talk_time_by_rep attr
  CROSS JOIN calls_funnel cf CROSS JOIN students_by_rep sr
  CROSS JOIN sources_metrics sm;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================================================
-- FUNCTION 3: get_fs_engagement_analytics
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_fs_engagement_analytics(
  p_start_date DATE,
  p_end_date DATE,
  p_representative TEXT DEFAULT 'All Representatives',
  p_form_name TEXT DEFAULT 'All Forms',
  p_table_filter TEXT DEFAULT 'uncalled',
  p_min_duration INT DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE := p_start_date;
  v_end_date DATE := p_end_date;
  v_result JSON;
BEGIN
  IF v_start_date IS NULL THEN
    v_start_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
  END IF;
  IF v_end_date IS NULL THEN
    v_end_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
  END IF;

  WITH 
    fs_reps AS (
      SELECT id, "Representative"
      FROM public."dRepresentatives"
      WHERE "Type" = 'FS Team'
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR "Representative" = p_representative)
    ),

    -- Todas as chamadas para KPIs globais do dashboard (sem filtrar p_min_duration)
    all_fs_calls AS (
      SELECT c.*, r."Representative" AS rep_name
      FROM public."fCalls" c
      JOIN fs_reps r ON c.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
      WHERE (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name)
    ),

    fs_calls_period AS (
      SELECT *
      FROM all_fs_calls
      WHERE "Date" >= v_start_date AND "Date" <= v_end_date
    ),

    all_submissions AS (
      SELECT s.*, r."Representative" AS ttpa_rep_name, ct."Source", ct."Form Name" AS crm_form_name
      FROM public."fSubmissions" s
      LEFT JOIN public."dRepresentatives" r ON s.representative_id = r.id
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email"))
           OR (s."Contact ID" IS NOT NULL AND s."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      WHERE s."Date" >= v_start_date AND s."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR s."Form Name" = p_form_name OR ct."Form Name" = p_form_name)
    ),

    all_deals AS (
      SELECT d.*
      FROM public."fDeals" d
      WHERE d."Date" >= v_start_date AND d."Date" <= v_end_date
    ),

    all_students AS (
      SELECT st.*
      FROM public."fStudents" st
      WHERE st."Date" >= v_start_date AND st."Date" <= v_end_date
    ),

    -- Contagem de chamadas por lead para a tabela de Follow-Up (aplica p_min_duration APENAS AQUI)
    submissions_call_counts AS (
      SELECT 
        s.id AS submission_id,
        s."First Name" || ' ' || COALESCE(s."Last Name", '') AS lead_name,
        s."Date" AS submission_date,
        COALESCE(s.ttpa_rep_name, 'Unassigned') AS ttpa_representative,
        s."Contact ID" AS contact_id,
        s."Phone" AS lead_phone,
        COUNT(c.id) AS fs_call_count,
        EXISTS (SELECT 1 FROM all_deals d WHERE d."Contact ID" = s."Contact ID") AS has_deal
      FROM all_submissions s
      LEFT JOIN all_fs_calls c ON right(regexp_replace(s."Phone", '\D', '', 'g'), 10) = right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10)
        AND (p_min_duration = 0 OR COALESCE(c."duration (in call)", c."duration (total)", 0) >= p_min_duration)
      GROUP BY s.id, s."First Name", s."Last Name", s."Date", s.ttpa_rep_name, s."Contact ID", s."Phone"
    ),

    kpi_cards AS (
      SELECT
        (SELECT COUNT(*) FROM fs_calls_period) AS calls_count,
        (SELECT COUNT(*) FROM all_submissions) AS leads_count,
        (SELECT COUNT(*) FROM all_deals) AS deals_count,
        (SELECT COUNT(*) FROM all_students) AS students_count,
        (SELECT COUNT(*) FROM submissions_call_counts WHERE fs_call_count = 0) AS leads_uncalled
    ),

    call_duration AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT 
          class_label AS label,
          cnt AS count,
          ROUND((cnt::numeric / NULLIF((SELECT calls_count FROM kpi_cards), 0)::numeric) * 100, 1)::text || '%' AS percentage,
          color
        FROM (
          SELECT 
            CASE 
              WHEN c."answered" = false OR COALESCE(c."duration (in call)", c."duration (total)", 0) = 0 THEN 'No answer calls'
              WHEN COALESCE(c."duration (in call)", c."duration (total)", 0) < 10 THEN '-10s Calls'
              WHEN COALESCE(c."duration (in call)", c."duration (total)", 0) BETWEEN 10 AND 29 THEN '+10s Calls'
              WHEN COALESCE(c."duration (in call)", c."duration (total)", 0) BETWEEN 30 AND 59 THEN '+30s Calls'
              ELSE '+1min Calls'
            END AS class_label,
            CASE 
              WHEN c."answered" = false OR COALESCE(c."duration (in call)", c."duration (total)", 0) = 0 THEN '#1E293B'
              WHEN COALESCE(c."duration (in call)", c."duration (total)", 0) < 10 THEN '#94A3B8'
              WHEN COALESCE(c."duration (in call)", c."duration (total)", 0) BETWEEN 10 AND 29 THEN '#2563EB'
              WHEN COALESCE(c."duration (in call)", c."duration (total)", 0) BETWEEN 30 AND 59 THEN '#F59E0B'
              ELSE '#10B981'
            END AS color,
            COUNT(*) AS cnt
          FROM fs_calls_period c
          GROUP BY class_label, color
          ORDER BY cnt DESC
        ) sub
      ) t
    ),

    calls_by_date AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT 
          to_char("Date", 'DD/MM/YYYY') AS date,
          COUNT(*) AS value
        FROM fs_calls_period
        GROUP BY "Date"
        ORDER BY "Date" ASC
      ) t
    ),

    calls_by_rep AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT 
          rep_name AS name,
          COUNT(*) AS value
        FROM fs_calls_period
        GROUP BY rep_name
        ORDER BY value DESC
      ) t
    ),

    leads_list AS (
      SELECT COALESCE(json_agg(t), '[]'::json) AS data
      FROM (
        SELECT 
          lead_name,
          to_char(submission_date, 'DD/MM/YYYY') AS submission_date,
          ttpa_representative,
          fs_call_count,
          'https://crm.myunifyai.com/contact/edit/' || contact_id AS crm_url
        FROM submissions_call_counts
        WHERE 
          (p_table_filter = 'uncalled' AND fs_call_count = 0)
          OR
          (p_table_filter = 'one_call' AND fs_call_count = 1 AND has_deal = false)
        ORDER BY submission_date DESC
      ) t
    )

  SELECT json_build_object(
    'kpis', json_build_object(
      'calls', k.calls_count,
      'calls_per_lead', CASE WHEN k.leads_count > 0 THEN ROUND(k.calls_count::numeric / k.leads_count::numeric, 1) ELSE 0 END,
      'leads', k.leads_count,
      'deals', k.deals_count,
      'students', k.students_count,
      'leads_uncalled', k.leads_uncalled
    ),
    'call_duration_distribution', cd.data,
    'calls_by_date', cbd.data,
    'calls_by_rep', cbr.data,
    'leads_table', ll.data
  ) INTO v_result
  FROM kpi_cards k
  CROSS JOIN call_duration cd
  CROSS JOIN calls_by_date cbd
  CROSS JOIN calls_by_rep cbr
  CROSS JOIN leads_list ll;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================================================
-- FUNCTION 4: get_kpi_drilldown_details
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_kpi_drilldown_details(
  p_start_date DATE,
  p_end_date DATE,
  p_representative TEXT DEFAULT 'All Representatives',
  p_form_name TEXT DEFAULT 'All Forms',
  p_kpi_type TEXT DEFAULT 'submissions',
  p_filter_dimension TEXT DEFAULT NULL,
  p_filter_value TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE := p_start_date;
  v_end_date DATE := p_end_date;
  v_result JSON;
BEGIN
  IF v_start_date IS NULL THEN
    v_start_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
  END IF;
  IF v_end_date IS NULL THEN
    v_end_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
  END IF;

  WITH 
    filtered_reps AS (
      SELECT id, "Representative"
      FROM public."dRepresentatives"
      WHERE "Type" = 'TTPA'
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR "Representative" = p_representative)
    ),

    raw_drilldown AS (
      -- Calls
      SELECT 
        'calls' AS kpi,
        c."Date" AS event_date,
        r."Representative" AS rep_name,
        COALESCE(ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        ct."Contact ID" AS contact_id,
        COALESCE(ct."Full Name", 'Contact ' || right(c."customer number", 4)) AS contact_name,
        ct."Email" AS contact_email,
        COALESCE(ct."Phone", c."customer number") AS contact_phone,
        to_char(c."Date", 'DD/MM/YYYY') AS formatted_date
      FROM public."fCalls" c
      JOIN filtered_reps r ON c.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
      WHERE c."Date" >= v_start_date AND c."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name)
      
      UNION ALL

      -- Submissions
      SELECT 
        'submissions' AS kpi,
        s."Date" AS event_date,
        r."Representative" AS rep_name,
        COALESCE(s."Form Name", ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        s."Contact ID" AS contact_id,
        COALESCE(ct."Full Name", s."First Name" || ' ' || COALESCE(s."Last Name", '')) AS contact_name,
        COALESCE(ct."Email", s."Email") AS contact_email,
        COALESCE(ct."Phone", s."Phone") AS contact_phone,
        to_char(s."Date", 'DD/MM/YYYY') AS formatted_date
      FROM public."fSubmissions" s
      JOIN filtered_reps r ON s.representative_id = r.id
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email"))
           OR (s."Contact ID" IS NOT NULL AND s."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN s."Email" IS NOT NULL AND s."Email" != '' AND LOWER(s."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      WHERE s."Date" >= v_start_date AND s."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR s."Form Name" = p_form_name OR ct."Form Name" = p_form_name)
      
      UNION ALL

      -- Deals
      SELECT 
        'deals' AS kpi,
        d."Date" AS event_date,
        COALESCE(r."Representative", 'Unassigned') AS rep_name,
        COALESCE(ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        d."Contact ID" AS contact_id,
        COALESCE(ct."Full Name", d."Name", 'Contact ' || right(d."Contact ID", 4)) AS contact_name,
        COALESCE(ct."Email", d."Email") AS contact_email,
        ct."Phone" AS contact_phone,
        to_char(d."Date", 'DD/MM/YYYY') AS formatted_date
      FROM public."fDeals" d
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (d."Email" IS NOT NULL AND d."Email" != '' AND LOWER(d."Email") = LOWER(ct."Email"))
           OR (d."Contact ID" IS NOT NULL AND d."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN d."Email" IS NOT NULL AND d."Email" != '' AND LOWER(d."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN public."fSubmissions" sub ON d."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r ON COALESCE(d.representative_id, ct.representative_id, sub.representative_id) = r.id
      WHERE d."Date" >= v_start_date AND d."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name OR sub."Form Name" = p_form_name)
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR r."Representative" = p_representative)

      UNION ALL

      -- Students
      SELECT 
        'students' AS kpi,
        st."Date" AS event_date,
        COALESCE(r."Representative", 'Unassigned') AS rep_name,
        COALESCE(ct."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct."Source", 'Unassigned') AS source,
        st."Contact ID" AS contact_id,
        COALESCE(ct."Full Name", st."Name", 'Contact ' || right(st."Contact ID", 4)) AS contact_name,
        COALESCE(ct."Email", st."Email") AS contact_email,
        ct."Phone" AS contact_phone,
        to_char(st."Date", 'DD/MM/YYYY') AS formatted_date
      FROM public."fStudents" st
      LEFT JOIN LATERAL (
        SELECT ct.*
        FROM public."dContacts_crm" ct
        WHERE (st."Email" IS NOT NULL AND st."Email" != '' AND LOWER(st."Email") = LOWER(ct."Email"))
           OR (st."Contact ID" IS NOT NULL AND st."Contact ID" = ct."Contact ID")
        ORDER BY 
          CASE WHEN st."Email" IS NOT NULL AND st."Email" != '' AND LOWER(st."Email") = LOWER(ct."Email") THEN 1 ELSE 2 END,
          CASE WHEN ct.representative_id IS NOT NULL THEN 1 ELSE 2 END
        LIMIT 1
      ) ct ON TRUE
      LEFT JOIN public."fSubmissions" sub ON st."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r ON COALESCE(st.representative_id, ct.representative_id, sub.representative_id) = r.id
      WHERE st."Date" >= v_start_date AND st."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR ct."Form Name" = p_form_name OR sub."Form Name" = p_form_name)
        AND (p_representative = 'All Representatives' 
             OR p_representative = 'Todos os Representantes' 
             OR r."Representative" = p_representative)
    )

  SELECT COALESCE(json_agg(t), '[]'::json) INTO v_result
  FROM (
    SELECT 
      contact_name,
      contact_email,
      contact_phone,
      rep_name,
      form_name,
      source,
      formatted_date AS date,
      kpi,
      CASE 
        WHEN contact_id IS NOT NULL THEN 'https://crm.myunifyai.com/contact/edit/' || contact_id 
        ELSE NULL 
      END AS crm_url
    FROM raw_drilldown
    WHERE kpi = p_kpi_type
      AND (
        p_filter_dimension IS NULL 
        OR (p_filter_dimension = 'form_name' AND form_name = p_filter_value)
        OR (p_filter_dimension = 'source' AND source = p_filter_value)
        OR (p_filter_dimension = 'representative' AND rep_name = p_filter_value)
        OR (p_filter_dimension = 'date' AND formatted_date = p_filter_value)
      )
    ORDER BY event_date DESC
    LIMIT 200
  ) t;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
