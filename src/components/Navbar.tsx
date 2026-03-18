import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IoSearch } from 'react-icons/io5';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { BiMenu } from 'react-icons/bi';
import { IoMdClose } from 'react-icons/io';

const Navbar: React.FC = () => {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl"
            style={{
                borderColor: 'rgba(255,255,255,0.06)',
                background: 'rgba(13, 15, 18, 0.85)',
            }}
        >
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5 group">
                    <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                        style={{ background: '#00C896' }}
                    >
                        <span
                            className="text-sm font-bold"
                            style={{ color: '#0D0F12', fontFamily: "'Bricolage Grotesque', sans-serif" }}
                        >
                            Z
                        </span>
                    </div>
                    <span
                        className="text-xl font-bold tracking-tight text-zinc-100"
                        style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}
                    >
                        Zemly
                    </span>
                </Link>

                {/* Desktop Nav Links */}
                <div className="hidden items-center gap-8 md:flex">
                    <a
                        href="#features"
                        className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-200"
                    >
                        Features
                    </a>
                    <a
                        href="#pricing"
                        className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-200"
                    >
                        Pricing
                    </a>
                    <a
                        href="#about"
                        className="text-sm font-medium text-zinc-500 transition-colors duration-200 hover:text-zinc-200"
                    >
                        About
                    </a>
                </div>

                {/* Desktop Right Section */}
                <div className="hidden items-center gap-2 md:flex">
                    <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-zinc-300"
                        aria-label="Search"
                    >
                        <IoSearch className="h-[17px] w-[17px]" />
                    </button>
                    <button
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-zinc-300"
                        aria-label="Menu"
                    >
                        <BsThreeDotsVertical className="h-[17px] w-[17px]" />
                    </button>
                    <div className="mx-2 h-5 w-px bg-zinc-800" />
                    <Link
                        to="/auth"
                        className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-zinc-200"
                    >
                        Log in
                    </Link>
                    <Link
                        to="/auth"
                        className="btn-emerald ml-1 rounded-lg px-5 py-2 text-sm"
                    >
                        Get Started
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/60 hover:text-zinc-100 md:hidden"
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
                    className="border-t px-6 pb-8 pt-6 backdrop-blur-xl md:hidden"
                    style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        background: 'rgba(13, 15, 18, 0.97)',
                    }}
                >
                    <div className="flex flex-col gap-5">
                        <a
                            href="#features"
                            className="text-base font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
                            onClick={() => setMobileOpen(false)}
                        >
                            Features
                        </a>
                        <a
                            href="#pricing"
                            className="text-base font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
                            onClick={() => setMobileOpen(false)}
                        >
                            Pricing
                        </a>
                        <a
                            href="#about"
                            className="text-base font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
                            onClick={() => setMobileOpen(false)}
                        >
                            About
                        </a>

                        <div className="my-1 h-px w-full bg-zinc-800/60" />

                        <div className="flex items-center gap-3">
                            <button
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
                                aria-label="Search"
                            >
                                <IoSearch className="h-[17px] w-[17px]" />
                            </button>
                            <button
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
                                aria-label="Settings"
                            >
                                <BsThreeDotsVertical className="h-[17px] w-[17px]" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 pt-1">
                            <Link
                                to="/auth"
                                className="rounded-lg px-5 py-3 text-center text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800/60 hover:text-zinc-100"
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
                        </div>
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
