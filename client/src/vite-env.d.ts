/// <reference types="vite/client" />

// The client's own environment variables (see client/.env.example).
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
