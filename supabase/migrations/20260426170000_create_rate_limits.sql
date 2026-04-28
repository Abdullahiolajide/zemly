-- Create a table for edge function rate limiting
CREATE TABLE public.rate_limits (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    function_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Index for fast counts over the last hour
CREATE INDEX idx_rate_limits_user_function_time ON public.rate_limits(user_id, function_name, created_at);

-- Grant service role permissions to bypass RLS (if active)
GRANT ALL ON public.rate_limits TO service_role;
