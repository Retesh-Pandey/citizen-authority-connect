DROP POLICY "issues readable" ON public.issues;
CREATE POLICY "issues readable in own area" ON public.issues FOR SELECT TO authenticated
USING (
  reporter_id = auth.uid()
  OR has_role(auth.uid(), 'authority'::app_role)
  OR state IS NULL
  OR state = (SELECT p.state FROM public.profiles p WHERE p.id = auth.uid())
);