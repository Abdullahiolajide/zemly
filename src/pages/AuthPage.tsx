import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabaseClient';
import Logo from '../components/Logo';

type EyeIconProps = {
    visible: boolean;
};

const EyeIcon: React.FC<EyeIconProps> = ({ visible }) => {
    if (visible) {
        return (
            <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                    d="M2 12c1.7-3.7 5.3-6 10-6s8.3 2.3 10 6c-1.7 3.7-5.3 6-10 6S3.7 15.7 2 12Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
        );
    }

    return (
        <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M3 3 21 21"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M10.6 6.25A10.2 10.2 0 0 1 12 6c4.7 0 8.3 2.3 10 6a10.56 10.56 0 0 1-3.06 3.84"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M6.2 6.83A11.1 11.1 0 0 0 2 12c1.7 3.7 5.3 6 10 6 1.47 0 2.82-.23 4.03-.66"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M9.88 9.88A3 3 0 0 0 14.12 14.12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const AuthPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const { setLoading } = useAuthStore();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (isSignUp) {
            setShowPassword(false);
            setShowConfirmPassword(false);
        }

        if (isSignUp && password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setIsSubmitting(true);
        setLoading(true);

        try {
            if (isSignUp) {
                // Sign Up
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email,
                    password,
                });

                if (signUpError) {
                    setError(signUpError.message);
                    return;
                }

                // Check if email confirmation is required
                if (data.user && !data.session) {
                    setSuccessMessage(
                        'Account created! Check your email for a confirmation link.'
                    );
                    setConfirmPassword('');
                    return;
                }

                // If auto-confirmed (e.g. email confirmation disabled in Supabase)
                if (data.session) {
                    setConfirmPassword('');
                    navigate('/dashboard');
                }
            } else {
                // Sign In
                const { error: signInError } = await
                    supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                if (signInError) {
                    setError(signInError.message);
                    return;
                }

                navigate('/dashboard');
            }
        } catch {
            setError('An unexpected error occurred. Please try again.');
        } finally {
            setIsSubmitting(false);
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        setSuccessMessage('');
        setIsGoogleLoading(true);

        try {
            const { error: googleError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/dashboard`,
                },
            });

            if (googleError) {
                setError(googleError.message);
            }
            // If successful, user will be redirected to Google's OAuth page
            // and then back to /dashboard. The onAuthStateChange listener
            // in App.tsx will handle setting the user/session.
        } catch {
            setError('Failed to start Google sign-in. Please try again.');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-dvh items-center justify-center bg-zinc-950 px-6 py-6 sm:py-8">
            {/* Auth Card */}
            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="mb-6 flex flex-col items-center text-center sm:mb-7">
                    <Link
                        to="/"
                        className="mb-4 flex items-center justify-center"
                    >
                        <Logo className="h-12" />
                    </Link>
                    <h1
                        className="text-2xl font-extrabold tracking-tight text-zinc-100 sm:text-3xl"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                    >
                        {isSignUp ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500 sm:text-base">
                        {isSignUp
                            ? 'Start organizing your thoughts with AI'
                            : 'Log in to continue where you left off'}
                    </p>
                </div>

                <div
                    key={isSignUp ? 'signup' : 'signin'}
                    className="auth-mode-panel px-1 py-1 sm:px-2"
                >
                    {/* Google Sign In */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isSubmitting}
                        className="auth-google-btn flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 text-sm font-medium text-zinc-200 transition-colors duration-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isGoogleLoading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-400/30 border-t-zinc-400" />
                        ) : (
                            <>
                                {/* Google Icon SVG */}
                                <svg
                                    className="h-5 w-5"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                >
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Continue with Google
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="my-5 flex items-center gap-4">
                        <div className="h-px flex-1 bg-zinc-800" />
                        <span className="text-xs font-medium text-zinc-500">
                            or continue with email
                        </span>
                        <div className="h-px flex-1 bg-zinc-800" />
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {/* Email */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="auth-email"
                                className="text-sm font-medium text-zinc-300"
                            >
                                Email
                            </label>
                            <input
                                id="auth-email"
                                type="email"
                                name="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@gmail.com"
                                autoComplete="email"
                                required
                                className="auth-input w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors duration-200 focus:bg-zinc-900/80"
                                style={{ fontFamily: "'DM Sans', sans-serif" }}
                            />
                        </div>

                        {/* Password */}
                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="auth-password"
                                className="text-sm font-medium text-zinc-300"
                            >
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    id="auth-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                    required
                                    minLength={6}
                                    className="auth-input w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3.5 pr-12 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors duration-200 focus:bg-zinc-900/80"
                                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:text-zinc-300"
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                    aria-pressed={showPassword}
                                >
                                    <EyeIcon visible={showPassword} />
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password (Sign Up only) */}
                        {isSignUp && (
                            <div className="animate-[authFieldIn_220ms_ease-out] flex flex-col gap-2">
                                <label
                                    htmlFor="auth-confirm-password"
                                    className="text-sm font-medium text-zinc-300"
                                >
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="auth-confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        name="confirmPassword"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                        required={isSignUp}
                                        minLength={6}
                                        className="auth-input w-full rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3.5 pr-12 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-colors duration-200 focus:bg-zinc-900/80"
                                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:text-zinc-300"
                                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                                        aria-pressed={showConfirmPassword}
                                    >
                                        <EyeIcon visible={showConfirmPassword} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
                                {error}
                            </p>
                        )}

                        {/* Success */}
                        {successMessage && (
                            <p className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
                                {successMessage}
                            </p>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting || isGoogleLoading}
                            className="btn-emerald mt-1 h-12 w-full !shadow-none text-sm transition-none hover:!scale-100 hover:!shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                            style={{ fontFamily: "'DM Sans', sans-serif" }}
                        >
                            {isSubmitting ? (
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            ) : isSignUp ? (
                                'Create Account'
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Toggle */}
                    <p className="mt-6 text-center text-sm text-zinc-400">
                        {isSignUp
                            ? 'Already have an account?'
                            : "Don't have an account?"}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                                setSuccessMessage('');
                                setConfirmPassword('');
                                setShowPassword(false);
                                setShowConfirmPassword(false);
                            }}
                            className="font-semibold transition-colors duration-200"
                            style={{ color: '#00C896' }}
                            onMouseEnter={e => ((e.target as HTMLElement).style.color = '#00DBA8')}
                            onMouseLeave={e => ((e.target as HTMLElement).style.color = '#00C896')}
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </p>

                    <p className="mt-4 text-center text-xs text-zinc-500">
                        By continuing, you agree to Zemly AI's{' '}
                        <Link to="/terms" className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300 transition-colors">
                            Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300 transition-colors">
                            Privacy Policy
                        </Link>.
                    </p>
                </div>

                {/* Back to Home */}
                <div className="mt-6 text-center">
                    <Link
                        to="/"
                        className="text-sm text-zinc-500 transition-colors duration-200 hover:text-zinc-300"
                    >
                        ← Back to home
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AuthPage;
