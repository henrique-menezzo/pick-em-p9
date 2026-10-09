/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'picks' | 'night' — see STUDY in lib/variants.ts */
  readonly VITE_STUDY?: string;
  readonly VITE_AUTO_ADVANCE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
