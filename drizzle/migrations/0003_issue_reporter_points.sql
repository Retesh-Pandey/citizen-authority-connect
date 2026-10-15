ALTER TABLE public.issues ADD COLUMN reporter_points integer NOT NULL DEFAULT 0;
UPDATE public.issues SET reporter_points = 10 + severity * 5 WHERE reporter_points = 0;