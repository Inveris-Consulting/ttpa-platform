-- Migration: Optimize TTPA Performance Queries and Indexes
-- Target functions: get_ttpa_performance_kpis and get_ttpa_performance_charts

-- 1. Create strategic indexes to accelerate fact table scans and join lookups
CREATE INDEX IF NOT EXISTS idx_fcalls_date_rep ON public."fCalls" ("Date", representative_id);
CREATE INDEX IF NOT EXISTS idx_fsubmissions_date_rep ON public."fSubmissions" ("Date", representative_id);
CREATE INDEX IF NOT EXISTS idx_fsubmissions_contact_id ON public."fSubmissions" ("Contact ID");
CREATE INDEX IF NOT EXISTS idx_fsubmissions_lower_email ON public."fSubmissions" (lower("Email"));
CREATE INDEX IF NOT EXISTS idx_fdeals_date_rep ON public."fDeals" ("Date", representative_id);
CREATE INDEX IF NOT EXISTS idx_fdeals_contact_id ON public."fDeals" ("Contact ID");
CREATE INDEX IF NOT EXISTS idx_fdeals_lower_email ON public."fDeals" (lower("Email"));
CREATE INDEX IF NOT EXISTS idx_fstudents_date_rep ON public."fStudents" ("Date", representative_id);
CREATE INDEX IF NOT EXISTS idx_fstudents_contact_id ON public."fStudents" ("Contact ID");
CREATE INDEX IF NOT EXISTS idx_fstudents_lower_email ON public."fStudents" (lower("Email"));
CREATE INDEX IF NOT EXISTS idx_dcontacts_crm_contact_id ON public."dContacts_crm" ("Contact ID");
CREATE INDEX IF NOT EXISTS idx_dcontacts_crm_form_name ON public."dContacts_crm" ("Form Name");
CREATE INDEX IF NOT EXISTS idx_dcontacts_crm_phone_clean ON public."dContacts_crm" (right(regexp_replace("Phone", '\D', '', 'g'), 10));
CREATE INDEX IF NOT EXISTS idx_fcalls_phone_clean ON public."fCalls" (right(regexp_replace(COALESCE("customer number", "to"), '\D', '', 'g'), 10));

-- 2. Optimized get_ttpa_performance_kpis
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
      WHERE c."Date" >= v_start_date AND c."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR EXISTS (
            SELECT 1 FROM public."dContacts_crm" ct
            WHERE ct."Form Name" = p_form_name
              AND right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
          )
        )
    ),

    submissions_base AS (
      SELECT s.*
      FROM public."fSubmissions" s
      JOIN filtered_reps r ON s.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct_email 
        ON s."Email" IS NOT NULL AND s."Email" <> '' AND LOWER(s."Email") = LOWER(ct_email."Email")
      LEFT JOIN public."dContacts_crm" ct_id 
        ON ct_email."Email" IS NULL AND s."Contact ID" IS NOT NULL AND s."Contact ID" = ct_id."Contact ID"
      WHERE s."Date" >= v_start_date AND s."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR s."Form Name" = p_form_name 
          OR ct_email."Form Name" = p_form_name 
          OR ct_id."Form Name" = p_form_name
        )
    ),

    deals_base AS (
      SELECT d.*
      FROM public."fDeals" d
      LEFT JOIN public."dContacts_crm" ct_email 
        ON d."Email" IS NOT NULL AND d."Email" <> '' AND LOWER(d."Email") = LOWER(ct_email."Email")
      LEFT JOIN public."dContacts_crm" ct_id 
        ON ct_email."Email" IS NULL AND d."Contact ID" IS NOT NULL AND d."Contact ID" = ct_id."Contact ID"
      LEFT JOIN public."fSubmissions" sub 
        ON d."Contact ID" IS NOT NULL AND d."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r 
        ON COALESCE(d.representative_id, ct_email.representative_id, ct_id.representative_id, sub.representative_id) = r.id
      WHERE d."Date" >= v_start_date AND d."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR ct_email."Form Name" = p_form_name 
          OR ct_id."Form Name" = p_form_name 
          OR sub."Form Name" = p_form_name
        )
        AND (
          p_representative = 'All Representatives' 
          OR p_representative = 'Todos os Representantes' 
          OR r."Representative" = p_representative
        )
    ),

    students_base AS (
      SELECT st.*
      FROM public."fStudents" st
      LEFT JOIN public."dContacts_crm" ct_email 
        ON st."Email" IS NOT NULL AND st."Email" <> '' AND LOWER(st."Email") = LOWER(ct_email."Email")
      LEFT JOIN public."dContacts_crm" ct_id 
        ON ct_email."Email" IS NULL AND st."Contact ID" IS NOT NULL AND st."Contact ID" = ct_id."Contact ID"
      LEFT JOIN public."fSubmissions" sub 
        ON st."Contact ID" IS NOT NULL AND st."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r 
        ON COALESCE(st.representative_id, ct_email.representative_id, ct_id.representative_id, sub.representative_id) = r.id
      WHERE st."Date" >= v_start_date AND st."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR ct_email."Form Name" = p_form_name 
          OR ct_id."Form Name" = p_form_name 
          OR sub."Form Name" = p_form_name
        )
        AND (
          p_representative = 'All Representatives' 
          OR p_representative = 'Todos os Representantes' 
          OR r."Representative" = p_representative
        )
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


-- 3. Optimized get_ttpa_performance_charts
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
      LEFT JOIN public."dContacts_crm" ct 
        ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
      WHERE c."Date" >= v_start_date AND c."Date" <= v_end_date
        AND (p_form_name = 'All Forms' OR p_form_name = 'Todos os Formulários' OR ct."Form Name" = p_form_name)
      
      UNION ALL
      
      -- Submissions
      SELECT 
        'submissions' AS kpi,
        s."Date" AS event_date,
        s."Hour" AS hour_num,
        r."Representative" AS rep_name,
        COALESCE(s."Form Name", ct_email."Form Name", ct_id."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct_email."Source", ct_id."Source", 'Unassigned') AS source,
        0 AS duration_in_call, 0 AS duration_total, true AS answered
      FROM public."fSubmissions" s
      JOIN filtered_reps r ON s.representative_id = r.id
      LEFT JOIN public."dContacts_crm" ct_email 
        ON s."Email" IS NOT NULL AND s."Email" <> '' AND LOWER(s."Email") = LOWER(ct_email."Email")
      LEFT JOIN public."dContacts_crm" ct_id 
        ON ct_email."Email" IS NULL AND s."Contact ID" IS NOT NULL AND s."Contact ID" = ct_id."Contact ID"
      WHERE s."Date" >= v_start_date AND s."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR s."Form Name" = p_form_name 
          OR ct_email."Form Name" = p_form_name 
          OR ct_id."Form Name" = p_form_name
        )
      
      UNION ALL
      
      -- Deals
      SELECT 
        'deals' AS kpi,
        d."Date" AS event_date,
        d."Hour" AS hour_num,
        COALESCE(r."Representative", CASE WHEN (ct_email."WFE" IS TRUE OR ct_id."WFE" IS TRUE) THEN 'WFE' ELSE 'Unassigned' END) AS rep_name,
        COALESCE(ct_email."Form Name", ct_id."Form Name", sub."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct_email."Source", ct_id."Source", 'Unassigned') AS source,
        0 AS duration_in_call, 0 AS duration_total, true AS answered
      FROM public."fDeals" d
      LEFT JOIN public."dContacts_crm" ct_email 
        ON d."Email" IS NOT NULL AND d."Email" <> '' AND LOWER(d."Email") = LOWER(ct_email."Email")
      LEFT JOIN public."dContacts_crm" ct_id 
        ON ct_email."Email" IS NULL AND d."Contact ID" IS NOT NULL AND d."Contact ID" = ct_id."Contact ID"
      LEFT JOIN public."fSubmissions" sub 
        ON d."Contact ID" IS NOT NULL AND d."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r 
        ON COALESCE(d.representative_id, ct_email.representative_id, ct_id.representative_id, sub.representative_id) = r.id
      WHERE d."Date" >= v_start_date AND d."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR ct_email."Form Name" = p_form_name 
          OR ct_id."Form Name" = p_form_name 
          OR sub."Form Name" = p_form_name
        )
        AND (
          p_representative = 'All Representatives' 
          OR p_representative = 'Todos os Representantes' 
          OR r."Representative" = p_representative
        )

      UNION ALL

      -- Students
      SELECT 
        'students' AS kpi,
        st."Date" AS event_date,
        st."Hour" AS hour_num,
        COALESCE(r."Representative", CASE WHEN (ct_email."WFE" IS TRUE OR ct_id."WFE" IS TRUE) THEN 'WFE' ELSE 'Unassigned' END) AS rep_name,
        COALESCE(ct_email."Form Name", ct_id."Form Name", sub."Form Name", 'Unassigned Form') AS form_name,
        COALESCE(ct_email."Source", ct_id."Source", 'Unassigned') AS source,
        0 AS duration_in_call, 0 AS duration_total, true AS answered
      FROM public."fStudents" st
      LEFT JOIN public."dContacts_crm" ct_email 
        ON st."Email" IS NOT NULL AND st."Email" <> '' AND LOWER(st."Email") = LOWER(ct_email."Email")
      LEFT JOIN public."dContacts_crm" ct_id 
        ON ct_email."Email" IS NULL AND st."Contact ID" IS NOT NULL AND st."Contact ID" = ct_id."Contact ID"
      LEFT JOIN public."fSubmissions" sub 
        ON st."Contact ID" IS NOT NULL AND st."Contact ID" = sub."Contact ID"
      LEFT JOIN public."dRepresentatives" r 
        ON COALESCE(st.representative_id, ct_email.representative_id, ct_id.representative_id, sub.representative_id) = r.id
      WHERE st."Date" >= v_start_date AND st."Date" <= v_end_date
        AND (
          p_form_name = 'All Forms' 
          OR p_form_name = 'Todos os Formulários'
          OR ct_email."Form Name" = p_form_name 
          OR ct_id."Form Name" = p_form_name 
          OR sub."Form Name" = p_form_name
        )
        AND (
          p_representative = 'All Representatives' 
          OR p_representative = 'Todos os Representantes' 
          OR r."Representative" = p_representative
        )
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
