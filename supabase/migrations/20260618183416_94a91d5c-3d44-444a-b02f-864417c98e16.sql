-- 1) BEFORE INSERT: forzar points_awarded = 1 (sello por visita), no manipulable desde el cliente
CREATE OR REPLACE FUNCTION public.visits_force_one_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.points_awarded := 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visits_force_one_stamp ON public.visits;
CREATE TRIGGER trg_visits_force_one_stamp
BEFORE INSERT ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.visits_force_one_stamp();

-- 2) AFTER INSERT: sumar sello a pets.points y desbloquear recompensas pendientes (idempotente)
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
     AND NOT EXISTS (
       SELECT 1 FROM public.pet_rewards pr
        WHERE pr.pet_id = NEW.pet_id
          AND pr.reward_rule_id = rr.id
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visits_apply_stamp_and_rewards ON public.visits;
CREATE TRIGGER trg_visits_apply_stamp_and_rewards
AFTER INSERT ON public.visits
FOR EACH ROW
EXECUTE FUNCTION public.visits_apply_stamp_and_rewards();