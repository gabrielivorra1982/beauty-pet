CREATE OR REPLACE FUNCTION public.profiles_prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
BEGIN
  -- Solo bloquea el cambio de rol si hay un usuario autenticado real (JWT) que NO es admin.
  -- El contexto de servidor (service role en Edge Functions) tiene auth.uid() NULL y debe poder
  -- asignar el rol al crear personal via admin-create-staff.
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar el rol del perfil';
  END IF;
  RETURN NEW;
END;
$func$;