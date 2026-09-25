# Canis CLI — local pipelines + llama-server

Serves **Gemma 4 + LoRA** to **Canis Studio** via a **pipeline API** on your machine (not raw llama.cpp from the browser).

| Layer | Port | Paste in Studio? |
|-------|------|------------------|
| **Canis pipeline server** | `5000` | **Yes** — `http://localhost:5000` |
| llama-server (llama.cpp) | `8080` | No (CLI talks to this internally) |

Live Studio: https://canis.appwrite.network — use **Continue as Guest**, then set the local URL in the AI sidebar.

## Quick start (Windows / Linux)

See **[`EDGE_SETUP.md`](EDGE_SETUP.md)** (llama.cpp install options + model layout).

```powershell
# Windows — one command
copy canis_env.example.bat canis_env.bat
.\setup-and-run.ps1

# Or step by step
.\setup-canis-edge.ps1 -InstallLlama -InstallLlamaVia winget -DownloadModels
.\run_edge.bat
```

**Models (HF):** base [gemma-4-E2B-it-Q4_K_M.gguf](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/blob/main/gemma-4-E2B-it-Q4_K_M.gguf) + LoRA [teach-multilingual-gemma-4-e2b-r3-Q4_K_M.gguf](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3/blob/main/teach-multilingual-gemma-4-e2b-r3-Q4_K_M.gguf).

```bash
# Linux
chmod +x setup-canis-edge.sh run_edge.sh start_llama_server.sh
./setup-canis-edge.sh --install-llama
cp canis_env.example.sh canis_env.sh
./run_edge.sh
```

## Manual install

```bash
cd cli
python -m venv .venv
source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -e .
python -m canis.interfaces.server --host 0.0.0.0 --port 5000
```

In another terminal: `start_llama_server.bat` / `./start_llama_server.sh`

## Docs

- [`EDGE_SETUP.md`](EDGE_SETUP.md) — **start here** (llama.cpp, models, browser localhost permissions)
- [`../docs/ONBOARDING.md`](../docs/ONBOARDING.md) — judge walkthrough
- [`../assets/teach-pipeline.md`](../assets/teach-pipeline.md) — TEACH flow diagram
- `run_edge.bat` / `run_all.bat` — Windows launchers

## Pipelines

Auto-loaded from [`examples/`](examples/) on server start (e.g. **`TEACH.json`** for guest demo + worksheet context).
