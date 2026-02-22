import { useState } from 'react';
import { Link } from 'react-router-dom';
import { IoSearch } from 'react-icons/io5';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { BiMenu } from 'react-icons/bi';
import { IoMdClose } from 'react-icons/io';

const Navbar: React.FC = () => {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
                {/* Logo */}
                <Link to="/" className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20">
                        <span className="text-base font-bold text-white">Z</span>
                    </div>
                    <span className="text-xl font-bold tracking-tight text-zinc-100">
                        Zemly
                    </span>
                </Link>

                {/* Desktop Nav Links */}
                <div className="hidden items-center gap-10 md:flex">
                    <a
                        href="#features"
                        className="text-sm font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
                    >
                        Features
                    </a>
                    <a
                        href="#pricing"
                        className="text-sm font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
                    >
                        Pricing
                    </a>
                    <a
                        href="#about"
                        className="text-sm font-medium text-zinc-400 transition-colors duration-200 hover:text-zinc-100"
                    >
                        About
                    </a>
                </div>

                {/* Desktop Right Section */}
                <div className="hidden items-center gap-3 md:flex">
                    <button
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100"
                        aria-label="Search"
                    >
                        <IoSearch className="h-[18px] w-[18px]" />
                    </button>
                    <button
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100"
                        aria-label="Menu"
                    >
                        <BsThreeDotsVertical className="h-[18px] w-[18px]" />
                    </button>
                    <div className="mx-2 h-6 w-px bg-zinc-800" />
                    <Link
                        to="/auth"
                        className="rounded-xl px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100"
                    >
                        Log in
                    </Link>
                    <Link
                        to="/auth"
                        className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110"
                    >
                        Get Started
                    </Link>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100 md:hidden"
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
                <div className="border-t border-zinc-800/60 bg-zinc-950/95 px-6 pb-8 pt-6 backdrop-blur-xl md:hidden">
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
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100"
                                aria-label="Search"
                            >
                                <IoSearch className="h-[18px] w-[18px]" />
                            </button>
                            <button
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100"
                                aria-label="Settings"
                            >
                                <BsThreeDotsVertical className="h-[18px] w-[18px]" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3 pt-1">
                            <Link
                                to="/auth"
                                className="rounded-xl px-5 py-3 text-center text-sm font-medium text-zinc-300 transition-colors duration-200 hover:bg-zinc-800/80 hover:text-zinc-100"
                                onClick={() => setMobileOpen(false)}
                            >
                                Log in
                            </Link>
                            <Link
                                to="/auth"
                                className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:shadow-indigo-500/40 hover:brightness-110"
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
