CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  issue_id uuid,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

CREATE OR REPLACE FUNCTION public.notify_issue_created() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  INSERT INTO notifications(user_id, issue_id, title, body)
  SELECT r.user_id, NEW.id, 'New issue nearby: ' || NEW.title,
         NEW.category || ' · ' || NEW.department || ' Dept · severity ' || NEW.severity || coalesce(' · ' || NEW.district, '')
  FROM user_roles r JOIN profiles p ON p.id = r.user_id
  WHERE r.role = 'authority' AND NEW.district IS NOT NULL AND p.district = NEW.district;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    INSERT INTO notifications(user_id, issue_id, title, body)
    SELECT r.user_id, NEW.id, 'New issue in your state: ' || NEW.title,
           NEW.category || ' · ' || NEW.department || ' Dept · severity ' || NEW.severity || coalesce(' · ' || NEW.district, '')
    FROM user_roles r JOIN profiles p ON p.id = r.user_id
    WHERE r.role = 'authority' AND (NEW.state IS NULL OR p.state = NEW.state);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER issues_notify_created AFTER INSERT ON public.issues FOR EACH ROW EXECUTE FUNCTION public.notify_issue_created();

CREATE OR REPLACE FUNCTION public.notify_issue_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO notifications(user_id, issue_id, title, body)
    VALUES (NEW.reporter_id, NEW.id,
      CASE WHEN NEW.status = 'Resolved' THEN 'Your report was resolved!' WHEN NEW.status = 'In Progress' THEN 'Work started on your report' ELSE 'Your report status changed' END,
      NEW.title || ' is now ' || NEW.status || coalesce(' — ' || NEW.ai_verdict, ''));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER issues_notify_status AFTER UPDATE OF status ON public.issues FOR EACH ROW EXECUTE FUNCTION public.notify_issue_status();
REVOKE EXECUTE ON FUNCTION public.notify_issue_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_issue_status() FROM PUBLIC, anon, authenticated;