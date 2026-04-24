import React from 'react';
import {
    IoClose,
    IoPersonOutline,
    IoSettingsOutline,
    IoSunnyOutline,
    IoCheckboxOutline,
    IoMoonOutline,
    IoLogOutOutline,
} from 'react-icons/io5';
import { useThemeStore, type ThemeChoice } from '../store/useThemeStore';

interface AccountSettingsModalProps {
    open: boolean;
    onClose: () => void;
    userName?: string | null;
    userEmail?: string | null;
    planLabel: string;
    isSubscribed: boolean;
    onUpgrade: () => void;
    onManageBilling: () => void;
    isManageBillingLoading: boolean;
    isLogoutLoading: boolean;
    onLogout: () => void;
}

const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ open, onClose, userName, userEmail, planLabel, isSubscribed, onUpgrade, onManageBilling, isManageBillingLoading, isLogoutLoading, onLogout }) => {
    const { theme, setTheme } = useThemeStore();

    if (!open) return null;

    const effectiveTheme: ThemeChoice = theme === 'system'
        ? document.documentElement.classList.contains('dark')
            ? 'dark'
            : 'light'
        : theme;

    const nextTheme: ThemeChoice = effectiveTheme === 'dark' ? 'light' : 'dark';
    const appearanceLabel = nextTheme === 'dark' ? 'Dark' : 'Light';
    const AppearanceIcon = nextTheme === 'dark' ? IoMoonOutline : IoSunnyOutline;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 backdrop-blur-sm cursor-pointer" onClick={onClose}>
            <div
                className="relative mx-4 w-full max-w-[820px] overflow-hidden rounded-[16px] shadow-[0_18px_60px_rgba(0,0,0,0.20)] cursor-default"
                style={{
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-glass-strong)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-300"
                    aria-label="Close account settings"
                    style={{ color: 'var(--text-sidebar)' }}
                >
                    <IoClose className="h-5 w-5" />
                </button>

                <div className="p-5 sm:p-8">
                    <div className="space-y-6 sm:space-y-5">
                        <section>
                            <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--text-sidebar-hover)' }}>
                                <IoPersonOutline className="h-4.5 w-4.5" />
                                <span>My profile</span>
                            </div>
                            <div className="mt-3 border-t pt-4" style={{ borderColor: 'var(--border-glass-strong)' }}>
                                <div className="space-y-5 sm:space-y-4 text-[15px]" style={{ color: 'var(--text-sidebar-hover)' }}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-6">
                                        <span style={{ color: 'var(--text-sidebar)' }}>Display name</span>
                                        <span className="font-medium sm:text-right">{userName || 'Not set'}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-6">
                                        <span style={{ color: 'var(--text-sidebar)' }}>Email</span>
                                        <span className="break-all font-medium sm:max-w-[60%] sm:text-right">{userEmail || 'Unknown'}</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
                                        <span style={{ color: 'var(--text-sidebar)' }}>Active plan</span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span
                                                className="rounded-full border px-3 py-1 text-[13px] font-medium shadow-sm"
                                                style={{
                                                    background: 'var(--bg-main)',
                                                    borderColor: 'var(--border-glass-strong)',
                                                    color: 'var(--text-sidebar-hover)',
                                                }}
                                            >
                                                {planLabel}
                                            </span>
                                            {!isSubscribed && (
                                                <button
                                                    onClick={onUpgrade}
                                                    className="btn-emerald inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold shadow-[0_2px_10px_rgba(0,200,150,0.22)] transition-transform hover:-translate-y-[1px]"
                                                >
                                                    <span className="text-[14px]">♛</span>
                                                    Upgrade to Unlimited
                                                </button>
                                            )}
                                            {isSubscribed && (
                                                <button
                                                    onClick={onManageBilling}
                                                    disabled={isManageBillingLoading}
                                                    className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                                                    style={{
                                                        background: 'var(--bg-main)',
                                                        borderColor: 'var(--border-glass-strong)',
                                                        color: 'var(--text-sidebar-hover)',
                                                    }}
                                                >
                                                    {isManageBillingLoading ? (
                                                        <>
                                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                            Opening...
                                                        </>
                                                    ) : (
                                                        'Manage Billing'
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--text-sidebar-hover)' }}>
                                <IoSettingsOutline className="h-4.5 w-4.5" />
                                <span>My settings</span>
                            </div>
                            <div className="mt-3 border-t pt-4" style={{ borderColor: 'var(--border-glass-strong)' }}>
                                <div className="space-y-4 text-[15px]" style={{ color: 'var(--text-sidebar-hover)' }}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
                                        <div>
                                            <div className="font-medium" style={{ color: 'var(--text-sidebar-hover)' }}>Appearance</div>
                                            <div className="text-[12px]" style={{ color: 'var(--text-sidebar)' }}>Customize how Zemly looks on your device.</div>
                                        </div>
                                        <button
                                            onClick={() => setTheme(nextTheme)}
                                            className="inline-flex self-start sm:self-auto items-center gap-2 text-[14px] font-medium transition-colors hover:opacity-80"
                                            style={{ color: 'var(--text-sidebar-hover)' }}
                                            aria-label={`Switch to ${appearanceLabel} mode`}
                                        >
                                            <AppearanceIcon className="h-4.5 w-4.5" />
                                            <span>{appearanceLabel}</span>
                                        </button>
                                    </div>

                                    {/* <div className="flex items-center justify-between gap-6">
                                        <div>
                                            <div className="font-medium" style={{ color: 'var(--text-sidebar-hover)' }}>Language</div>
                                            <div className="text-[12px]" style={{ color: 'var(--text-sidebar)' }}>Change the language of Feynman in the user interface.</div>
                                        </div>
                                        <button className="inline-flex items-center gap-2 text-[14px] font-medium transition-colors hover:opacity-80" style={{ color: 'var(--text-sidebar-hover)' }}>
                                            <IoLanguageOutline className="h-4.5 w-4.5" />
                                            <span>English</span>
                                            <IoChevronDown className="h-4 w-4" style={{ color: 'var(--text-sidebar)' }} />
                                        </button>
                                    </div> */}
                                </div>
                            </div>
                        </section>

                        <section>
                            <div className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--text-sidebar-hover)' }}>
                                <IoCheckboxOutline className="h-4.5 w-4.5" />
                                <span>Account actions</span>
                            </div>
                            <div className="mt-3 border-t pt-4" style={{ borderColor: 'var(--border-glass-strong)' }}>
                                <div className="flex justify-end">
                                    <button
                                        onClick={onLogout}
                                        disabled={isLogoutLoading}
                                        className="inline-flex items-center gap-2 text-[14px] font-medium text-red-500 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {isLogoutLoading ? (
                                            <>
                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                                Logging out...
                                            </>
                                        ) : (
                                            <>
                                                <IoLogOutOutline className="h-5 w-5" />
                                                <span>Logout</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountSettingsModal;
