REVOKE SELECT (password, password_hash, two_factor_code) ON public.profiles FROM public, authenticated, anon;
