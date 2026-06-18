
-- Función updated_at compartida
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- store_config
CREATE TABLE public.store_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Kiwoko',
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_config TO anon, authenticated;
GRANT ALL ON public.store_config TO service_role;
CREATE TRIGGER trg_store_config_updated BEFORE UPDATE ON public.store_config
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- profiles (enlace a auth.users sin trigger todavía)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'operador' CHECK (role IN ('admin','operador')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated;
GRANT ALL ON public.profiles TO service_role;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- owners
CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO anon, authenticated;
GRANT ALL ON public.owners TO service_role;
CREATE TRIGGER trg_owners_updated BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- pets
CREATE TABLE public.pets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  name text NOT NULL,
  breed text,
  coat_type text NOT NULL DEFAULT 'desconocido'
    CHECK (coat_type IN ('con_pelo','sin_pelo','desconocido')),
  photo_url text,
  notes text,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pets TO anon, authenticated;
GRANT ALL ON public.pets TO service_role;
CREATE INDEX idx_pets_owner_id ON public.pets(owner_id);
CREATE TRIGGER trg_pets_updated BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- visits (sin la FK chosen_cut_id todavía, se añade después de cut_suggestions)
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  visited_at timestamptz NOT NULL DEFAULT now(),
  photo_url text,
  recognized_breed text,
  recognized_coat text CHECK (recognized_coat IN ('con_pelo','sin_pelo','desconocido')),
  chosen_cut_id uuid,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visits TO anon, authenticated;
GRANT ALL ON public.visits TO service_role;
CREATE INDEX idx_visits_pet_id ON public.visits(pet_id);
CREATE TRIGGER trg_visits_updated BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- cut_suggestions
CREATE TABLE public.cut_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id uuid NOT NULL REFERENCES public.visits(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position BETWEEN 1 AND 4),
  title text NOT NULL,
  description text,
  image_url text,
  is_chosen boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cut_suggestions TO anon, authenticated;
GRANT ALL ON public.cut_suggestions TO service_role;
CREATE INDEX idx_cut_suggestions_visit_id ON public.cut_suggestions(visit_id);

-- FK diferida visits.chosen_cut_id -> cut_suggestions(id)
ALTER TABLE public.visits
  ADD CONSTRAINT visits_chosen_cut_id_fkey
  FOREIGN KEY (chosen_cut_id) REFERENCES public.cut_suggestions(id) ON DELETE SET NULL;

-- reward_rules
CREATE TABLE public.reward_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  threshold_visits integer NOT NULL DEFAULT 1,
  reward_text text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reward_rules TO anon, authenticated;
GRANT ALL ON public.reward_rules TO service_role;
CREATE TRIGGER trg_reward_rules_updated BEFORE UPDATE ON public.reward_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- pet_rewards
CREATE TABLE public.pet_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  reward_rule_id uuid NOT NULL REFERENCES public.reward_rules(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pet_rewards TO anon, authenticated;
GRANT ALL ON public.pet_rewards TO service_role;
CREATE INDEX idx_pet_rewards_pet_id ON public.pet_rewards(pet_id);
