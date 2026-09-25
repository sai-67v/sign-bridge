interface ImportMetaEnv {
  readonly VITE_CANISCLI_URL?: string
  /** When `"true"`, PAD talks to the local Canis CLI pipeline server (`localhost:5000` by default). Otherwise connections are skipped (no noise when CLI is off). */
  readonly VITE_PAD_LOCAL_AI?: string
  readonly VITE_APPWRITE_ENDPOINT?: string
  readonly VITE_APPWRITE_PROJECT_ID?: string
  readonly VITE_APPWRITE_DATABASE_ID?: string
  readonly VITE_APPWRITE_BUCKET_MATERIALS?: string
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

