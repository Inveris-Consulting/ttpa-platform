-- Historical WFE membership used by the TTPA Bonus dashboard.
-- dRepresentatives.wfe remains the source of truth for a representative's
-- current status; this table records the effective dates used for bonus runs.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS public.representative_wfe_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  representative_id uuid NOT NULL REFERENCES public."dRepresentatives"(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT representative_wfe_periods_valid_dates
    CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT representative_wfe_periods_no_overlap
    EXCLUDE USING gist (
      representative_id WITH =,
      daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
    )
);

CREATE INDEX IF NOT EXISTS representative_wfe_periods_representative_dates_idx
  ON public.representative_wfe_periods (representative_id, start_date, end_date);

ALTER TABLE public.representative_wfe_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read WFE membership periods"
  ON public.representative_wfe_periods
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  );

CREATE POLICY "Representatives can read their own WFE membership periods"
  ON public.representative_wfe_periods
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
        AND users.representative_id = representative_wfe_periods.representative_id
    )
  );

CREATE POLICY "Admins can add WFE membership periods"
  ON public.representative_wfe_periods
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can edit WFE membership periods"
  ON public.representative_wfe_periods
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete WFE membership periods"
  ON public.representative_wfe_periods
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  );

-- Preserve the current behavior on first rollout. Administrators can revise
-- these initial periods to reflect the actual historical membership.
INSERT INTO public.representative_wfe_periods (representative_id, start_date)
SELECT id, DATE '2026-08-01'
FROM public."dRepresentatives"
WHERE wfe IS TRUE
  AND "Type" = 'TTPA'
  AND NOT EXISTS (
    SELECT 1
    FROM public.representative_wfe_periods p
    WHERE p.representative_id = public."dRepresentatives".id
  );
