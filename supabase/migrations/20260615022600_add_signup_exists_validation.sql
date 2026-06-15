-- Create functions to check if email or phone already exists during signup (bypassing RLS)
CREATE OR REPLACE FUNCTION public.check_if_email_exists(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)
  ) OR EXISTS (
    SELECT 1 FROM public.empresas WHERE lower(email) = lower(p_email)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_if_phone_exists(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users WHERE phone = p_phone
  ) OR EXISTS (
    SELECT 1 FROM public.empresas WHERE telefono = p_phone
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE telefono = p_phone
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_if_email_exists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_if_phone_exists(text) TO anon, authenticated;
