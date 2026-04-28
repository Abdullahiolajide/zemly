CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_user_id uuid,
    p_function_name text,
    p_limit integer,
    p_window_seconds integer DEFAULT 3600
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_count integer;
    lock_key bigint;
BEGIN
    lock_key := hashtextextended(p_user_id::text || ':' || p_function_name, 0);
    PERFORM pg_advisory_xact_lock(lock_key);

    SELECT count(*)
    INTO current_count
    FROM public.rate_limits
    WHERE user_id = p_user_id
      AND function_name = p_function_name
      AND created_at >= now() - make_interval(secs => p_window_seconds);

    IF current_count >= p_limit THEN
        RETURN true;
    END IF;

    INSERT INTO public.rate_limits (user_id, function_name)
    VALUES (p_user_id, p_function_name);

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text, integer, integer) TO service_role;