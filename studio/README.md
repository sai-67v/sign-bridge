# Canis Studio

Classroom web app: notes, classes, worksheets, AI tutoring sidebar, teacher dashboards.

| | |
|---|---|
| **Live demo** | https://canis.appwrite.network |
| **Stack** | React + Appwrite + optional local Canis CLI |

This directory is the **public** Canis Studio source for the Gemma 4 Good repository.

## Local dev

```bash
npm install
cp env.example .env.local
# Required for Appwrite-backed features:
#   VITE_APPWRITE_ENDPOINT, VITE_APPWRITE_PROJECT_ID, VITE_APPWRITE_DATABASE_ID
# Optional local AI:
#   VITE_CANISCLI_URL=http://localhost:5000
npm run start
```

See [`../SECURITY.md`](../SECURITY.md) — do not commit real `.env` files.

## Local AI

Run [`../cli/`](../cli/) and `llama-server` with Gemma 4 + R3 adapter. The hosted demo uses separately configured backends.

## Note on pilots

There was **no formal classroom pilot** of this Studio build for the hackathon submission. Research evidence is under [`../lesson/`](../lesson/) (R1 A/B, paper).
