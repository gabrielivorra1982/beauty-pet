
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.visits_apply_stamp_and_rewards() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profiles_prevent_role_escalation() FROM PUBLIC, anon, authenticated;
