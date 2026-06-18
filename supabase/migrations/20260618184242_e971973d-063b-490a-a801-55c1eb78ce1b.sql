-- 1) UNIQUE para garantizar idempotencia desde el esquema
ALTER TABLE public.pet_rewards
  ADD CONSTRAINT pet_rewards_pet_rule_unique UNIQUE (pet_id, reward_rule_id);

-- 2) Reescribir el trigger AFTER para usar ON CONFLICT DO NOTHING
CREATE OR REPLACE FUNCTION public.visits_apply_stamp_and_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_points integer;
BEGIN
  UPDATE public.pets
     SET points = points + COALESCE(NEW.points_awarded, 0),
         updated_at = now()
   WHERE id = NEW.pet_id
  RETURNING points INTO current_points;

  IF current_points IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.pet_rewards (pet_id, reward_rule_id)
  SELECT NEW.pet_id, rr.id
    FROM public.reward_rules rr
   WHERE rr.active = true
     AND rr.threshold_visits <= current_points
  ON CONFLICT (pet_id, reward_rule_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3) Revoke también en la función BEFORE (la AFTER ya estaba revocada)
REVOKE EXECUTE ON FUNCTION public.visits_force_one_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.visits_force_one_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.visits_force_one_stamp() FROM authenticated;