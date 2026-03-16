-- Ce script supprime toutes les anciennes politiques RLS liées aux profils 
-- et les remplace par une vérification d'authentification basique.

DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    -- 1. Suppression dynamique de TOUTES les anciennes politiques sur les tables principales
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('familles', 'personnes', 'photos')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. Création des nouvelles politiques simplifiées pour les administrateurs et activation du RLS
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'familles') THEN
        EXECUTE 'ALTER TABLE public.familles ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Admin full access" ON public.familles';
        EXECUTE 'CREATE POLICY "Admin full access" ON public.familles FOR ALL USING (auth.uid() IS NOT NULL)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'personnes') THEN
        EXECUTE 'ALTER TABLE public.personnes ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Admin full access" ON public.personnes';
        EXECUTE 'CREATE POLICY "Admin full access" ON public.personnes FOR ALL USING (auth.uid() IS NOT NULL)';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'photos') THEN
        EXECUTE 'ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Admin full access" ON public.photos';
        EXECUTE 'CREATE POLICY "Admin full access" ON public.photos FOR ALL USING (auth.uid() IS NOT NULL)';
    END IF;
END $$;