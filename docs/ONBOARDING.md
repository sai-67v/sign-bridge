# Onboarding — Canis Gemma 4 Good submission

Step-by-step path for judges and contributors.

## 1. Hosted Studio (no local GPU)

1. Open https://canis.appwrite.network
2. **Continue as Guest**
3. Read **Welcome — start here** (intro pad)
4. Optional: **Teacher dashboard (demo)** in the sidebar

Guest mode is read-only; demo content is served from Appwrite.

## 2. Local edge AI (recommended for full TEACH behavior)

### Windows

```powershell
cd cli
copy canis_env.example.bat canis_env.bat
# One command (setup + run):
.\setup-and-run.ps1
# Or step by step:
.\setup-canis-edge.ps1 -InstallLlama -InstallLlamaVia winget -DownloadModels
.\run_edge.bat
```

### Linux

```bash
cd cli
cp canis_env.example.sh canis_env.sh
./setup-canis-edge.sh
./run_edge.sh
```

Details: [`cli/EDGE_SETUP.md`](../cli/EDGE_SETUP.md) — includes **browser/OS permissions** for localhost.

### Verify

```bash
curl http://127.0.0.1:8080/health
curl http://localhost:5000/v1/health
curl http://localhost:5000/v1/pipelines
```

You should see pipeline **`TEACH`** loaded.

## 3. Connect Studio to your machine

1. Keep `run_edge` running (ports **8080** + **5000**)
2. In Studio guest mode, open the **A1 worksheet**
3. AI sidebar → set URL to `http://localhost:5000`
4. Ask: *help me with A1* or the German shortcut prompt from the welcome pad

## 4. What runs where

| Component | Port | Role |
|-----------|------|------|
| llama-server | 8080 | Gemma 4 base + `teach` LoRA |
| Canis API | 5000 | TEACH pipeline, context, session |
| Canis Studio | HTTPS | UI, worksheets, AI sidebar |

## 5. Training & weights (optional)

- Dataset: [CanisAI/teach-r3-multilingual](https://huggingface.co/datasets/CanisAI/teach-r3-multilingual)
- Adapter: [CanisAI/teach-multilingual-gemma-4-e2b-r3](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3)
- Re-train: [`training/README.md`](../training/README.md)

## 6. Research evidence (not R3 pilot)

R1-era classroom research tooling: [`lesson/README.md`](../lesson/README.md)
