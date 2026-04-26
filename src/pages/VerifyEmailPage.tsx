import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';

const VerifyEmailPage: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const email = searchParams.get('email') ?? '';

    const handleVerified = () => {
        navigate('/dashboard');
    };

    return (
        <div className="relative flex min-h-dvh items-center justify-center bg-zinc-950 px-6 py-6 sm:py-8">
            <div className="relative z-10 w-full max-w-md px-2 text-center">
                <Link to="/" className="mb-6 inline-flex items-center justify-center">
                    <Logo className="h-12" />
                </Link>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-8 sm:px-8">
                    <h1
                        className="text-2xl font-extrabold tracking-tight text-zinc-100 sm:text-3xl"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif", letterSpacing: '-0.02em' }}
                    >
                        Check your email
                    </h1>

                    <p className="mt-3 text-sm text-zinc-400 sm:text-base">
                        We sent a confirmation link to
                    </p>

                    <p className="mt-1 break-all text-sm font-semibold text-zinc-200 sm:text-base">
                        {email || 'your inbox'}
                    </p>

                    <p className="mt-4 text-sm text-zinc-500">
                        Open the email and verify your account, then come back here.
                    </p>

                    <button
                        type="button"
                        onClick={handleVerified}
                        className="btn-emerald mt-7 h-12 w-full !shadow-none text-sm transition-none hover:!scale-100 hover:!shadow-none"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                        I have verified
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <Link
                        to="/auth?mode=signin"
                        className="text-sm text-zinc-500 transition-colors duration-200 hover:text-zinc-300"
                    >
                        Back to sign in
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmailPage;
