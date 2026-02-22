import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdAutoAwesome } from 'react-icons/md';
import { useAuthStore } from '../store/useAuthStore';
import { supabase } from '../lib/supabaseClient';

const AuthPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
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
                    return;
                }

                // If auto-confirmed (e.g. email confirmation disabled in Supabase)
                if (data.session) {
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
        <div className="relative flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-16">
            {/* Background glow */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/8 blur-[140px]" />
                <div className="absolute bottom-1/4 right-1/3 h-[400px] w-[400px] rounded-full bg-purple-600/6 blur-[120px]" />
            </div>

            {/* Auth Card */}
            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="mb-10 flex flex-col items-center text-center">
                    <Link
                        to="/"
                        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25 transition-transform duration-200 hover:scale-105"
                    >
                        <MdAutoAwesome className="h-7 w-7 text-white" />
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
                        {isSignUp ? 'Create your account' : 'Welcome back'}
                    </h1>
                    <p className="mt-3 text-sm text-zinc-400 sm:text-base">
                        {isSignUp
                            ? 'Start organizing your thoughts with AI'
                            : 'Log in to continue where you left off'}
                    </p>
                </div>

                {/* Glassmorphism Card */}
                <div className="rounded-2xl border border-white/10 bg-white/5 px-7 py-10 shadow-2xl backdrop-blur-md sm:px-10">
                    {/* Google Sign In */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isSubmitting}
                        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 text-sm font-medium text-zinc-200 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                    <div className="my-7 flex items-center gap-4">
                        <div className="h-px flex-1 bg-zinc-800" />
                        <span className="text-xs font-medium text-zinc-500">
                            or continue with email
                        </span>
                        <div className="h-px flex-1 bg-zinc-800" />
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
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
                            <input
                                id="auth-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                minLength={6}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-4 py-3.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-all duration-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                            />
                        </div>

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
                            className="mt-1 flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
                    <p className="mt-8 text-center text-sm text-zinc-400">
                        {isSignUp
                            ? 'Already have an account?'
                            : "Don't have an account?"}{' '}
                        <button
                            type="button"
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError('');
                                setSuccessMessage('');
                            }}
                            className="font-semibold text-indigo-400 transition-colors duration-200 hover:text-indigo-300"
                        >
                            {isSignUp ? 'Sign in' : 'Sign up'}
                        </button>
                    </p>
                </div>

                {/* Back to Home */}
                <div className="mt-8 text-center">
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
