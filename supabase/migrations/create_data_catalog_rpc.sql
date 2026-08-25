-- Migration: Create get_data_catalog_explorer RPC function
-- File: supabase/migrations/create_data_catalog_rpc.sql

CREATE OR REPLACE FUNCTION public.get_data_catalog_explorer(
  p_entity TEXT, -- 'calls', 'submissions', 'deals', 'students'
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_representative TEXT DEFAULT 'All Representatives',
  p_form_source TEXT DEFAULT 'All Forms/Sources',
  p_search_name TEXT DEFAULT NULL,
  p_search_phone TEXT DEFAULT NULL,
  p_search_email TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 10
)
RETURNS JSON AS $$
DECLARE
  v_start_date DATE := p_start_date;
  v_end_date DATE := p_end_date;
  v_curr_week_start DATE := date_trunc('week', CURRENT_DATE)::date;
  v_curr_week_end DATE := CURRENT_DATE;
  v_last_week_start DATE := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
  v_last_week_end DATE := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
  v_curr_month_start DATE := date_trunc('month', CURRENT_DATE)::date;
  v_curr_month_end DATE := CURRENT_DATE;
  
  v_offset INT := (GREATEST(p_page, 1) - 1) * GREATEST(p_page_size, 1);
  v_result JSON;
BEGIN
  IF v_start_date IS NULL THEN
    v_start_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '7 days')::date;
  END IF;
  IF v_end_date IS NULL THEN
    v_end_date := (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day')::date;
  END IF;

  IF p_entity = 'calls' THEN
    WITH 
      base_calls AS (
        SELECT 
          c.id,
          c."Date",
          c."Time",
          COALESCE(c."Representative", r."Representative", 'Unassigned') AS rep_name,
          COALESCE(c."customer number", c."to", c."from") AS phone,
          c."duration (total)" AS duration_total,
          c."duration (in call)" AS duration_in_call,
          c."answered",
          c."direction",
          c."call direction - type" AS call_type,
          ct."Contact ID" AS contact_id,
          COALESCE(ct."Full Name", 'Contact ' || right(COALESCE(c."customer number", c."to"), 4)) AS contact_name,
          ct."Email" AS contact_email
        FROM public."fCalls" c
        LEFT JOIN public."dRepresentatives" r ON c.representative_id = r.id
        LEFT JOIN public."dContacts_crm" ct ON right(regexp_replace(COALESCE(c."customer number", c."to"), '\D', '', 'g'), 10) = right(regexp_replace(ct."Phone", '\D', '', 'g'), 10)
        WHERE (p_representative = 'All Representatives' OR p_representative = 'Todos os Representantes' OR COALESCE(c."Representative", r."Representative") = p_representative)
          AND (p_search_name IS NULL OR p_search_name = '' OR COALESCE(ct."Full Name", '') ILIKE '%' || p_search_name || '%')
          AND (p_search_phone IS NULL OR p_search_phone = '' OR COALESCE(c."customer number", c."to", c."from", ct."Phone", '') ILIKE '%' || p_search_phone || '%')
          AND (p_search_email IS NULL OR p_search_email = '' OR COALESCE(ct."Email", '') ILIKE '%' || p_search_email || '%')
      ),
      metrics AS (
        SELECT
          (SELECT COUNT(*) FROM base_calls WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS total_period,
          (SELECT COUNT(*) FROM base_calls WHERE "Date" >= v_curr_week_start AND "Date" <= v_curr_week_end) AS current_week,
          (SELECT COUNT(*) FROM base_calls WHERE "Date" >= v_last_week_start AND "Date" <= v_last_week_end) AS last_week,
          (SELECT COUNT(*) FROM base_calls WHERE "Date" >= v_curr_month_start AND "Date" <= v_curr_month_end) AS current_month,
          (SELECT COUNT(*) FROM base_calls WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS filtered_total
      ),
      paginated_rows AS (
        SELECT COALESCE(json_agg(t), '[]'::json) AS data
        FROM (
          SELECT 
            id::text,
            to_char("Date", 'DD/MM/YYYY') AS date,
            COALESCE("Time", '') AS time,
            rep_name AS representative,
            contact_name AS name,
            COALESCE(phone, '') AS phone,
            COALESCE(contact_email, '') AS email,
            COALESCE(duration_in_call, duration_total, 0) AS duration,
            answered,
            COALESCE(direction, '') AS direction,
            CASE WHEN contact_id IS NOT NULL THEN 'https://crm.myunifyai.com/contact/edit/' || contact_id ELSE NULL END AS crm_url
          FROM base_calls
          WHERE "Date" >= v_start_date AND "Date" <= v_end_date
          ORDER BY "Date" DESC, "Time" DESC NULLS LAST
          OFFSET v_offset LIMIT p_page_size
        ) t
      )
    SELECT json_build_object(
      'summary', json_build_object(
        'total_period', m.total_period,
        'current_week', m.current_week,
        'last_week', m.last_week,
        'current_month', m.current_month,
        'total_records', m.filtered_total
      ),
      'rows', r.data
    ) INTO v_result
    FROM metrics m CROSS JOIN paginated_rows r;

  ELSIF p_entity = 'submissions' THEN
    WITH 
      base_subs AS (
        SELECT 
          s.id,
          s."Date",
          s."time",
          COALESCE(s."Representative", r."Representative", 'Unassigned') AS rep_name,
          s."First Name" || ' ' || COALESCE(s."Last Name", '') AS lead_name,
          COALESCE(s."Phone", ct."Phone", '') AS phone,
          COALESCE(s."Email", ct."Email", '') AS email,
          COALESCE(s."Form Name", ct."Form Name", 'Unassigned Form') AS form_name,
          COALESCE(s."Source", ct."Source", 'Unassigned') AS source,
          s."City",
          s."State",
          s."Contact ID" AS contact_id
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
        WHERE (p_representative = 'All Representatives' OR p_representative = 'Todos os Representantes' OR COALESCE(s."Representative", r."Representative") = p_representative)
          AND (p_form_source = 'All Forms/Sources' OR s."Form Name" = p_form_source OR ct."Form Name" = p_form_source OR ct."Source" = p_form_source)
          AND (p_search_name IS NULL OR p_search_name = '' OR (s."First Name" || ' ' || COALESCE(s."Last Name", '')) ILIKE '%' || p_search_name || '%')
          AND (p_search_phone IS NULL OR p_search_phone = '' OR COALESCE(s."Phone", ct."Phone", '') ILIKE '%' || p_search_phone || '%')
          AND (p_search_email IS NULL OR p_search_email = '' OR COALESCE(s."Email", ct."Email", '') ILIKE '%' || p_search_email || '%')
      ),
      metrics AS (
        SELECT
          (SELECT COUNT(*) FROM base_subs WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS total_period,
          (SELECT COUNT(*) FROM base_subs WHERE "Date" >= v_curr_week_start AND "Date" <= v_curr_week_end) AS current_week,
          (SELECT COUNT(*) FROM base_subs WHERE "Date" >= v_last_week_start AND "Date" <= v_last_week_end) AS last_week,
          (SELECT COUNT(*) FROM base_subs WHERE "Date" >= v_curr_month_start AND "Date" <= v_curr_month_end) AS current_month,
          (SELECT COUNT(*) FROM base_subs WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS filtered_total
      ),
      paginated_rows AS (
        SELECT COALESCE(json_agg(t), '[]'::json) AS data
        FROM (
          SELECT 
            id::text,
            to_char("Date", 'DD/MM/YYYY') AS date,
            COALESCE("time", '') AS time,
            rep_name AS representative,
            lead_name AS name,
            phone,
            email,
            form_name,
            source,
            COALESCE("City", '') AS city,
            COALESCE("State", '') AS state,
            CASE WHEN contact_id IS NOT NULL THEN 'https://crm.myunifyai.com/contact/edit/' || contact_id ELSE NULL END AS crm_url
          FROM base_subs
          WHERE "Date" >= v_start_date AND "Date" <= v_end_date
          ORDER BY "Date" DESC, "time" DESC NULLS LAST
          OFFSET v_offset LIMIT p_page_size
        ) t
      )
    SELECT json_build_object(
      'summary', json_build_object(
        'total_period', m.total_period,
        'current_week', m.current_week,
        'last_week', m.last_week,
        'current_month', m.current_month,
        'total_records', m.filtered_total
      ),
      'rows', r.data
    ) INTO v_result
    FROM metrics m CROSS JOIN paginated_rows r;

  ELSIF p_entity = 'deals' THEN
    WITH 
      base_deals AS (
        SELECT 
          d.id,
          d."Date",
          d."time",
          COALESCE(r."Representative", ct_rep."Representative", sub_rep."Representative", 'Unassigned') AS rep_name,
          COALESCE(d."Name", ct."Full Name", 'Deal ' || right(d."Contact ID", 4)) AS deal_name,
          COALESCE(d."Email", ct."Email", '') AS email,
          COALESCE(ct."Phone", '') AS phone,
          COALESCE(d."Stage", 'Unassigned Stage') AS stage,
          COALESCE(d."Source", ct."Source", 'Unassigned') AS source,
          COALESCE(d."Program Enrollment", '') AS program_enrollment,
          d."Contact ID" AS contact_id
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
        LEFT JOIN public."dRepresentatives" r ON d.representative_id = r.id
        LEFT JOIN public."dRepresentatives" ct_rep ON ct.representative_id = ct_rep.id
        LEFT JOIN public."dRepresentatives" sub_rep ON sub.representative_id = sub_rep.id
        WHERE (p_representative = 'All Representatives' OR p_representative = 'Todos os Representantes' OR COALESCE(r."Representative", ct_rep."Representative", sub_rep."Representative") = p_representative)
          AND (p_form_source = 'All Forms/Sources' OR d."Source" = p_form_source OR ct."Source" = p_form_source OR ct."Form Name" = p_form_source)
          AND (p_search_name IS NULL OR p_search_name = '' OR COALESCE(d."Name", ct."Full Name", '') ILIKE '%' || p_search_name || '%')
          AND (p_search_phone IS NULL OR p_search_phone = '' OR COALESCE(ct."Phone", '') ILIKE '%' || p_search_phone || '%')
          AND (p_search_email IS NULL OR p_search_email = '' OR COALESCE(d."Email", ct."Email", '') ILIKE '%' || p_search_email || '%')
      ),
      metrics AS (
        SELECT
          (SELECT COUNT(*) FROM base_deals WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS total_period,
          (SELECT COUNT(*) FROM base_deals WHERE "Date" >= v_curr_week_start AND "Date" <= v_curr_week_end) AS current_week,
          (SELECT COUNT(*) FROM base_deals WHERE "Date" >= v_last_week_start AND "Date" <= v_last_week_end) AS last_week,
          (SELECT COUNT(*) FROM base_deals WHERE "Date" >= v_curr_month_start AND "Date" <= v_curr_month_end) AS current_month,
          (SELECT COUNT(*) FROM base_deals WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS filtered_total
      ),
      paginated_rows AS (
        SELECT COALESCE(json_agg(t), '[]'::json) AS data
        FROM (
          SELECT 
            id::text,
            to_char("Date", 'DD/MM/YYYY') AS date,
            COALESCE("time", '') AS time,
            rep_name AS representative,
            deal_name AS name,
            phone,
            email,
            stage,
            source,
            program_enrollment,
            CASE WHEN contact_id IS NOT NULL THEN 'https://crm.myunifyai.com/contact/edit/' || contact_id ELSE NULL END AS crm_url
          FROM base_deals
          WHERE "Date" >= v_start_date AND "Date" <= v_end_date
          ORDER BY "Date" DESC, "time" DESC NULLS LAST
          OFFSET v_offset LIMIT p_page_size
        ) t
      )
    SELECT json_build_object(
      'summary', json_build_object(
        'total_period', m.total_period,
        'current_week', m.current_week,
        'last_week', m.last_week,
        'current_month', m.current_month,
        'total_records', m.filtered_total
      ),
      'rows', r.data
    ) INTO v_result
    FROM metrics m CROSS JOIN paginated_rows r;

  ELSE -- 'students'
    WITH 
      base_students AS (
        SELECT 
          st.id,
          st."Date",
          st."time",
          COALESCE(r."Representative", ct_rep."Representative", sub_rep."Representative", 'Unassigned') AS rep_name,
          COALESCE(st."Name", ct."Full Name", 'Student ' || right(st."Contact ID", 4)) AS student_name,
          COALESCE(st."Email", ct."Email", '') AS email,
          COALESCE(ct."Phone", '') AS phone,
          COALESCE(st."Stage", 'Student Enrolled') AS stage,
          COALESCE(st."Source", ct."Source", 'Unassigned') AS source,
          COALESCE(st."Program Enrollment", '') AS program_enrollment,
          st."Contact ID" AS contact_id
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
        LEFT JOIN public."dRepresentatives" r ON st.representative_id = r.id
        LEFT JOIN public."dRepresentatives" ct_rep ON ct.representative_id = ct_rep.id
        LEFT JOIN public."dRepresentatives" sub_rep ON sub.representative_id = sub_rep.id
        WHERE (p_representative = 'All Representatives' OR p_representative = 'Todos os Representantes' OR COALESCE(r."Representative", ct_rep."Representative", sub_rep."Representative") = p_representative)
          AND (p_form_source = 'All Forms/Sources' OR st."Source" = p_form_source OR ct."Source" = p_form_source OR ct."Form Name" = p_form_source)
          AND (p_search_name IS NULL OR p_search_name = '' OR COALESCE(st."Name", ct."Full Name", '') ILIKE '%' || p_search_name || '%')
          AND (p_search_phone IS NULL OR p_search_phone = '' OR COALESCE(ct."Phone", '') ILIKE '%' || p_search_phone || '%')
          AND (p_search_email IS NULL OR p_search_email = '' OR COALESCE(st."Email", ct."Email", '') ILIKE '%' || p_search_email || '%')
      ),
      metrics AS (
        SELECT
          (SELECT COUNT(*) FROM base_students WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS total_period,
          (SELECT COUNT(*) FROM base_students WHERE "Date" >= v_curr_week_start AND "Date" <= v_curr_week_end) AS current_week,
          (SELECT COUNT(*) FROM base_students WHERE "Date" >= v_last_week_start AND "Date" <= v_last_week_end) AS last_week,
          (SELECT COUNT(*) FROM base_students WHERE "Date" >= v_curr_month_start AND "Date" <= v_curr_month_end) AS current_month,
          (SELECT COUNT(*) FROM base_students WHERE "Date" >= v_start_date AND "Date" <= v_end_date) AS filtered_total
      ),
      paginated_rows AS (
        SELECT COALESCE(json_agg(t), '[]'::json) AS data
        FROM (
          SELECT 
            id::text,
            to_char("Date", 'DD/MM/YYYY') AS date,
            COALESCE("time", '') AS time,
            rep_name AS representative,
            student_name AS name,
            phone,
            email,
            stage,
            source,
            program_enrollment,
            CASE WHEN contact_id IS NOT NULL THEN 'https://crm.myunifyai.com/contact/edit/' || contact_id ELSE NULL END AS crm_url
          FROM base_students
          WHERE "Date" >= v_start_date AND "Date" <= v_end_date
          ORDER BY "Date" DESC, "time" DESC NULLS LAST
          OFFSET v_offset LIMIT p_page_size
        ) t
      )
    SELECT json_build_object(
      'summary', json_build_object(
        'total_period', m.total_period,
        'current_week', m.current_week,
        'last_week', m.last_week,
        'current_month', m.current_month,
        'total_records', m.filtered_total
      ),
      'rows', r.data
    ) INTO v_result
    FROM metrics m CROSS JOIN paginated_rows r;

  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
