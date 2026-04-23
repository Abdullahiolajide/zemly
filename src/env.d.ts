/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    readonly VITE_DODO_PRODUCT_ID?: string;
    readonly VITE_DODO_MONTHLY_PRODUCT_ID?: string;
    readonly VITE_DODO_ANNUAL_PRODUCT_ID?: string;
    readonly VITE_DODO_MODE?: 'test' | 'live';
    readonly VITE_PODCAST_RAISE_HAND_GREETING_AUDIO_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
