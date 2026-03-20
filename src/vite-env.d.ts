/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_KEY: string
  readonly VITE_AIRTABLE_TOKEN: string
  readonly VITE_GOOGLE_MAPS_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
