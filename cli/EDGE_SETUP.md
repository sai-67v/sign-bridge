# Canis Edge Setup — llama.cpp + Canis CLI + Studio

Run **inference on your machine** and connect **Canis Studio** (https://canis.appwrite.network) to your local **pipeline server** — not to a cloud model API.

## What you are starting (two layers)

| Layer | Port | Role |
|-------|------|------|
| **llama-server** (llama.cpp) | `8080` | GGUF base model + LoRA adapters (edge inference) |
| **Canis API** (`python -m canis.interfaces.server`) | `5000` | Pipelines (`TEACH.json`), context injection, multi-step routing |

**Paste into Studio (guest AI sidebar):** `http://localhost:5000`

---

## Browser & OS permissions (required for Studio → your PC)

Canis Studio runs in the **browser** (hosted at https://canis.appwrite.network). Your **local** Canis API listens on `http://127.0.0.1:5000` (or `http://localhost:5000`). The browser must be allowed to call that address:

| Layer | What to allow |
|-------|----------------|
| **Browser** | No extension blocking `localhost` / `127.0.0.1`. In Chrome/Edge, private-network access to loopback is usually allowed for user-initiated requests from a page you opened. |
| **Windows Firewall** | When `llama-server` or Python first starts, approve **Private network** access for `llama-server.exe` and `python.exe` if prompted. |
| **Antivirus** | Allow the same binaries to bind ports **8080** (inference) and **5000** (Canis API). |
| **HTTPS → HTTP** | The hosted Studio page is HTTPS; it calls your **HTTP** localhost API. This is normal for local dev; keep the API on `127.0.0.1` only (default). |

If the AI sidebar shows connection errors:

1. Confirm `curl http://localhost:5000/v1/health` works in a terminal on the **same machine** as the browser.
2. Use `http://localhost:5000` (not `https://`) in the sidebar.
3. Start **both** `llama-server` (:8080) and the Canis API (:5000) via `run_edge.bat` / `run_edge.sh`.

---

## TEACH adapter name

The **TEACH** pipeline always uses the LoRA registered as **`teach`** (not per-subject adapters). After setup, sync creates:

```text
canis-models/lora/teach/teach.gguf
```

The Canis API auto-enables this adapter on startup (`CANIS_TEACH_ADAPTER=teach` in `canis_env.bat`).

---

## Quick start

### Windows

```powershell
cd cli
# Fastest on Windows (Vulkan build; good for many GPUs):
.\setup-canis-edge.ps1 -InstallLlama -InstallLlamaVia winget -DownloadModels
# Or GitHub CUDA zip (best for NVIDIA; large download):
.\setup-canis-edge.ps1 -InstallLlama -InstallLlamaVia github -DownloadModels
# Auto: GitHub first, winget fallback
.\setup-canis-edge.ps1 -InstallLlama -DownloadModels
.\run_edge.bat
```

Or install llama.cpp alone: `winget install -e --id ggml.llamacpp`

### Linux

```bash
cd cli
chmod +x setup-canis-edge.sh run_edge.sh start_llama_server.sh
./setup-canis-edge.sh
./run_edge.sh
```

---

## Installing llama.cpp (recommended paths)

### Option A — Pre-built binaries (recommended)

Official releases: https://github.com/ggml-org/llama.cpp/releases

| Platform | Pick a release asset |
|----------|----------------------|
| **Windows x64 (CPU)** | `llama-*-bin-win-cpu-x64.zip` |
| **Windows + NVIDIA** | `llama-*-bin-win-cuda-12.4-x64.zip` (or cuda-13.x; match your driver) |
| **Linux x64 (CPU)** | `llama-*-bin-linux-x64.zip` |
| **Linux + NVIDIA** | `llama-*-bin-linux-cuda-cu12.2.0-x64.zip` |

1. Download and extract to a folder (e.g. `%USERPROFILE%\llama.cpp` or `~/llama.cpp`).
2. Confirm `llama-server` / `llama-server.exe` is on PATH or set `LLAMA_DIR` in `canis_env.bat` / `canis_env.sh`.
3. Our setup script does this with `-InstallLlama` (download is **hundreds of MB** and can take **5-15+ minutes** on a slow connection — that is normal).

**Why pre-built:** No Visual Studio / CMake toolchain required; fastest path for demos and classrooms.

### Option B — Build from source (advanced)

Docs: https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md

```bash
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
cmake -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release -j
# binary: build/bin/llama-server
```

Windows: use **x64 Native Tools Command Prompt for VS 2022** and the same CMake flow.

### Option C — Package managers (Linux)

Some distros ship `llama.cpp` packages; versions may lag behind upstream. Prefer **Option A** for Gemma 4 + LoRA features.

---

## Models & adapters

| Artifact | Source |
|----------|--------|
| Base GGUF | [unsloth/gemma-4-E2B-it-GGUF](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF) → `gemma-4-E2B-it-Q4_K_M.gguf` (~3.1 GB) |
| Canis R3 LoRA (GGUF) | [CanisAI/teach-multilingual-gemma-4-e2b-r3](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3) → `teach-multilingual-gemma-4-e2b-r3-Q4_K_M.gguf` (~51 MB) |

These are the **confirmed** pair for Gemma 4 edge demo. Place under `%USERPROFILE%\canis.teach\GEMMA\` or run `.\setup-canis-edge.ps1 -DownloadModels` (uses `canis_env.example.bat` HF vars).

LoRA must be **GGUF** for llama-server. The published [Canis R3 adapter](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3) is already GGUF.

Default layout after setup:

```text
%USERPROFILE%\canis.edge\   (Windows)
~/canis.edge/               (Linux)
  models\   *.gguf
  adapters\ <name>\*.gguf
```

Override paths in `canis_env.bat` / `canis_env.sh` (copy from `.example`).

---

## Environment files

```batch
copy canis_env.example.bat canis_env.bat
```

```bash
cp canis_env.example.sh canis_env.sh
```

| Variable | Meaning |
|----------|---------|
| `LLAMA_DIR` | Folder containing `llama-server` |
| `MODEL_PATH` | Full path to base `.gguf` |
| `ADAPTERS_DIR` | Folder of adapter subdirs with `.gguf` files |
| `CANIS_API_PORT` | Canis pipeline server (default `5000`) |
| `LLAMA_PORT` | llama-server (default `8080`) |

---

## Verify

```bash
curl http://127.0.0.1:8080/health
curl http://localhost:5000/v1/health
curl http://localhost:5000/v1/pipelines
```

Studio: **Continue as Guest** → open A1 worksheet → AI sidebar → `http://localhost:5000` → “help me with A1”.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Studio: “Demo workspace not set up” | Appwrite demo tables + anonymous auth (hosted); unrelated to CLI |
| Empty pipeline list | Start Canis API from `cli/`; check `TEACH` in `examples/` |
| 401 / permission on demo notes | Appwrite table needs `read("users")` for anonymous sessions |
| llama connection failed | Start `start_llama_server.bat` / `.sh` first; check `MODEL_PATH` |
| `llama-server.exe not found in C:\llama.cpp-gemma4` | Setup usually installs to **`%USERPROFILE%\llama.cpp-gemma4`**. Set `LLAMA_DIR` in `canis_env.bat` to that folder, or re-run `.\setup-canis-edge.ps1 -InstallLlama` (writes `canis_env.bat`). |
| `llama-server.exe not found after extract` | Re-run `.\setup-canis-edge.ps1 -InstallLlama` (older script picked wrong zip). Or download `llama-*-bin-win-cuda-*-x64.zip` manually from [releases](https://github.com/ggml-org/llama.cpp/releases) |
| Adapter not applied | Use `.gguf` LoRA; comma-separated `--lora` in launcher |
