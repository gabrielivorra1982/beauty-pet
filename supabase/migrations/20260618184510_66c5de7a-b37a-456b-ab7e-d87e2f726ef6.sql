
-- =========================================================
-- PASO 1: Helper is_admin() y trigger anti-escalada de rol
-- =========================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Trigger anti-escalada
CREATE OR REPLACE FUNCTION public.profiles_prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el rol del perfil';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_prevent_role_escalation();

-- =========================================================
-- PASO 2: Activar RLS y crear políticas
-- =========================================================

-- ---- profiles ----
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_auth" ON public.profiles;
CREATE POLICY "profiles_select_auth" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_insert_admin" ON public.profiles;
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- owners ----
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owners_all_auth" ON public.owners;
CREATE POLICY "owners_all_auth" ON public.owners
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- pets ----
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pets_all_auth" ON public.pets;
CREATE POLICY "pets_all_auth" ON public.pets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- visits ----
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "visits_all_auth" ON public.visits;
CREATE POLICY "visits_all_auth" ON public.visits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- cut_suggestions ----
ALTER TABLE public.cut_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cut_suggestions_all_auth" ON public.cut_suggestions;
CREATE POLICY "cut_suggestions_all_auth" ON public.cut_suggestions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- pet_rewards (solo SELECT; los INSERT los hace el trigger SECURITY DEFINER) ----
ALTER TABLE public.pet_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pet_rewards_select_auth" ON public.pet_rewards;
CREATE POLICY "pet_rewards_select_auth" ON public.pet_rewards
  FOR SELECT TO authenticated USING (true);

-- ---- reward_rules ----
ALTER TABLE public.reward_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reward_rules_select_auth" ON public.reward_rules;
CREATE POLICY "reward_rules_select_auth" ON public.reward_rules
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reward_rules_insert_admin" ON public.reward_rules;
CREATE POLICY "reward_rules_insert_admin" ON public.reward_rules
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reward_rules_update_admin" ON public.reward_rules;
CREATE POLICY "reward_rules_update_admin" ON public.reward_rules
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "reward_rules_delete_admin" ON public.reward_rules;
CREATE POLICY "reward_rules_delete_admin" ON public.reward_rules
  FOR DELETE TO authenticated USING (public.is_admin());

-- ---- store_config ----
ALTER TABLE public.store_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_config_select_auth" ON public.store_config;
CREATE POLICY "store_config_select_auth" ON public.store_config
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "store_config_insert_admin" ON public.store_config;
CREATE POLICY "store_config_insert_admin" ON public.store_config
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "store_config_update_admin" ON public.store_config;
CREATE POLICY "store_config_update_admin" ON public.store_config
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "store_config_delete_admin" ON public.store_config;
CREATE POLICY "store_config_delete_admin" ON public.store_config
  FOR DELETE TO authenticated USING (public.is_admin());
