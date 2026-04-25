import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BiMenu } from 'react-icons/bi';
import { IoMdClose } from 'react-icons/io';
import { useAuthStore } from '../store/useAuthStore';
import Logo from './Logo';

const Navbar: React.FC = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const user = useAuthStore((state) => state.user);
    const isLoggedIn = Boolean(user);

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
            style={{
                borderColor: 'var(--border-glass)',
                background: 'rgba(var(--navbar-bg, 255,255,255), 0.92)',
            }}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-2.5 lg:px-8">
                {/* Logo */}
                <Link to="/" className="flex items-center group">
                    <Logo className="h-8 transition-transform duration-200 group-hover:scale-[1.02]" />
                </Link>

                {/* Desktop Nav Links */}
                <div className="hidden items-center gap-8 md:flex">
                    <a
                        href="/#features"
                        className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-900"
                        style={{ color: 'var(--text-sidebar)', }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar-hover)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar)')}
                    >
                        Features
                    </a>
                    <Link
                        to="/about"
                        className="text-sm font-medium transition-colors duration-200"
                        style={{ color: 'var(--text-sidebar)' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar-hover)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar)')}
                    >
                        About
                    </Link>
                    <Link
                        to="/contact"
                        className="text-sm font-medium transition-colors duration-200"
                        style={{ color: 'var(--text-sidebar)' }}
                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar-hover)')}
                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar)')}
                    >
                        Contact
                    </Link>
                </div>

                {/* Desktop Right Section */}
                <div className="hidden items-center gap-2 md:flex">
                    {isLoggedIn ? (
                        <Link
                            to="/dashboard"
                            className="btn-emerald rounded-lg px-5 py-2 text-sm"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                to="/auth"
                                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200"
                                style={{ color: 'var(--text-sidebar)' }}
                                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar-hover)')}
                                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-sidebar)')}
                            >
                                Log in
                            </Link>
                            <Link
                                to="/auth"
                                className="btn-emerald rounded-lg px-5 py-2 text-sm"
                            >
                                Get Started
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Toggle */}
                <button
                    className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-200 md:hidden"
                    style={{ color: 'var(--text-sidebar)' }}
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Toggle menu"
                >
                    {mobileOpen ? (
                        <IoMdClose className="h-5 w-5" />
                    ) : (
                        <BiMenu className="h-5 w-5" />
                    )}
                </button>
            </div>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div
                    className="border-t px-6 pb-8 pt-5 md:hidden"
                    style={{
                        borderColor: 'var(--border-glass)',
                        background: 'var(--bg-main)',
                    }}
                >
                    <div className="flex flex-col gap-5">
                        <a
                            href="/#features"
                            className="text-base font-medium transition-colors duration-200"
                            style={{ color: 'var(--text-sidebar)' }}
                            onClick={() => setMobileOpen(false)}
                        >
                            Features
                        </a>
                        <Link
                            to="/about"
                            className="text-base font-medium transition-colors duration-200"
                            style={{ color: 'var(--text-sidebar)' }}
                            onClick={() => setMobileOpen(false)}
                        >
                            About
                        </Link>
                        <Link
                            to="/contact"
                            className="text-base font-medium transition-colors duration-200"
                            style={{ color: 'var(--text-sidebar)' }}
                            onClick={() => setMobileOpen(false)}
                        >
                            Contact
                        </Link>

                        <div className="my-1 h-px w-full" style={{ background: 'var(--border-glass)' }} />

                        <div className="flex flex-col gap-3">
                            {isLoggedIn ? (
                                <Link
                                    to="/dashboard"
                                    className="btn-emerald w-full py-3 text-sm"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        to="/auth"
                                        className="rounded-lg px-5 py-3 text-center text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900"
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        to="/auth"
                                        className="btn-emerald w-full py-3 text-sm"
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        Get Started
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
