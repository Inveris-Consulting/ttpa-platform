-- The manual representative-fix workflow is available only to TTPA admins.
CREATE POLICY "Admins can read representative fixes"
  ON public.representative_fix
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can add representative fixes"
  ON public.representative_fix
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid()) AND users.role = 'admin'
    )
  );
