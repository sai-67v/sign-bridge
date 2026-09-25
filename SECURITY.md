# Security

This repository is a **public** Gemma 4 Good submission mirror. The private Canis monorepo is **not** included.

## Secrets

- **Never** commit `.env`, API keys, Appwrite admin keys, Hugging Face tokens, or Infisical dumps.
- Appwrite **project ID**, **database ID**, and **endpoint** must be supplied via environment variables at build/deploy time (`studio/.env.example`).
- The hosted demo at https://canis.appwrite.network is configured in the deployment platform, not in git.

## If credentials were exposed

A previous revision briefly contained a hardcoded Appwrite project ID in source. If you forked before sanitization:

1. Rotate or restrict API keys in the Appwrite Console.
2. Review Appwrite audit logs for unexpected access.
3. Do not rely on security through obscurity of project IDs.

## Reporting

Contact the repository owner via GitHub issues (no secrets in public issues).
