DROP POLICY "read roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY "profiles readable" ON public.profiles;
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());

DROP POLICY "read photos" ON storage.objects;
CREATE POLICY "read own photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'issue-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE OR REPLACE FUNCTION public.get_leaderboard(_role app_role)
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.* FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = _role)
  ORDER BY p.points DESC LIMIT 20
$$;
REVOKE ALL ON FUNCTION public.get_leaderboard(app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(app_role) TO authenticated;