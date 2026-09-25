# canis-gemma4good — Optimized MVP Phase Plan (Antigravity Orchestration)

Lean, sequential MVP plan for stitching Pipeline A (audio → subtitle) and Pipeline B (sign → virtual camera) into the existing `canis-gemma4good` repo. Each phase is one file per prompt, with a manual checkpoint before moving to the next — so a failure is isolated to a single file, not a whole pipeline.

---

## Phase 0 — Scaffold Only
**Owner:** Antigravity Manager View, single prompt

**Prompt:**
> Scan `canis-gemma4good`. Create `config.py` in root with VRAM_BUDGET_MB=3500, SAMPLE_RATE=16000, VIDEO_SIZE=(1280,720), FPS=30. Create empty dirs `pipeline_a/` and `pipeline_b/` with `__init__.py` in each. No other code.

Wait for full completion and approval before starting Phase 1.

---

## Phase 1 — Pipeline A (Audio → Subtitle)

### 1a — Audio capture only
**Prompt (Claude Code):**
> Implement `pipeline_a/audio_capture.py`: `sounddevice.InputStream` with WASAPI loopback, writing PCM float32 chunks to an `asyncio.Queue`. Include a `if __name__ == "__main__"` block that prints queue size every second for 10 seconds. No transcription yet.

**Checkpoint:** run standalone, confirm audio chunks are flowing.

### 1b — Transcription only
**Prompt (Claude Code):**
> Implement `pipeline_a/speech_transcriber.py`: `faster_whisper.WhisperModel('distil-large-v3', compute_type='int8_float16')`, consumes from the queue in `audio_capture.py`, prints transcribed text to console. No VAD, no UI.

**Checkpoint:** run both files together, confirm text prints correctly.

### 1c — Overlay UI
**Prompt (Claude Code):**
> Implement `pipeline_a/floating_overlay.py`: PyQt6 `QMainWindow`, `Qt.WindowType.FramelessWindowHint` + `Qt.WindowType.WindowTransparentForInput`, text updated via `pyqtSignal` from the transcriber thread.

**Checkpoint — Pipeline A MVP done.** Live subtitles should appear on screen. Confirm before starting Pipeline B.

---

## Phase 2 — Pipeline B (Sign → Virtual Camera)

### 2a — Landmarks only
**Prompt (Claude Code):**
> Implement `pipeline_b/landmark_extractor.py` using `mediapipe.solutions.hands` (not holistic — MVP scope). Print detected landmark count to console for 10 seconds via webcam.

### 2b — Candidate search, stubbed
**Prompt (Claude Code):**
> Implement `pipeline_b/candidate_search.py` with a hardcoded 10-word vector dictionary and plain numpy cosine similarity (no FAISS yet). Takes landmarks from `landmark_extractor.py`, prints best-match word to console.

**Checkpoint:** confirm console prints a plausible word before touching camera output.

### 2c — Confirm the model interface (manual step, not an agent prompt)
Before wiring anything into `canis-gemma4good`, check its actual entry point directly, or ask Claude Code:
> Inspect `canis-gemma4good`'s inference code. What is the exact function signature I should call to pass a list of candidate words and get fluent text back?

Don't let the agent guess this interface — confirm it explicitly.

### 2d — Virtual camera output
**Prompt (Claude Code):**
> Implement `pipeline_b/virtual_camera.py`: take the matched word string, draw with `cv2.putText`, broadcast via `pyvirtualcam.Camera(1280, 720, fps=30)`. Do not call `canis-gemma4good` yet — use the raw matched word only.

**Checkpoint — Pipeline B MVP done.** A word banner should appear on the virtual camera.

---

## Phase 3 — Wire In the Real Model
**Prompt (Claude Code, using the confirmed signature from 2c):**
> In `candidate_search.py`, pass Top-3 matches into `canis-gemma4good`'s `[confirmed function name]` to produce fluent text, replacing the raw word before it reaches `virtual_camera.py`.

---

## Phase 4 — Orchestration
**Prompt (Claude Code):**
> Create `main.py`: `asyncio.gather()` running Pipeline A and Pipeline B, PyQt6 on main thread, heavy inference offloaded to a shared `ThreadPoolExecutor`.

**Final checkpoint:** both pipelines running concurrently for 60 seconds without blocking each other.

---

## Reference: Repo Stitching Map

| External Component | Repository | Source Files | Destination |
|---|---|---|---|
| System Audio Capture | spatialaudio/python-sounddevice | `sounddevice.py` (WASAPI loopback) | `pipeline_a/audio_capture.py` |
| STT & Silero VAD | SYSTRAN/faster-whisper | `faster_whisper/transcribe.py`, `vad.py` | `pipeline_a/speech_transcriber.py` |
| Transparent Overlay | qt/qtbase (via PyQt6) | `PyQt6.QtWidgets` (`Qt.WindowTransparentForInput`) | `pipeline_a/floating_overlay.py` |
| 3D Pose Landmarks | google-ai-edge/mediapipe | `mediapipe/python/solutions/holistic.py` | `pipeline_b/landmark_extractor.py` |
| Pose Normalization | sign-language-processing/pose | `pose_format/pose.py`, `pose_format/utils/` | `pipeline_b/pose_encoder.py` |
| Vector Similarity Index | facebookresearch/faiss | `faiss/python/` (IndexFlatIP) | `pipeline_b/candidate_search.py` |
| Virtual Cam Output | letmaik/pyvirtualcam | `pyvirtualcam/camera.py` | `pipeline_b/virtual_camera.py` |

Note: MVP phases above use `mediapipe.solutions.hands` and plain numpy cosine similarity as lighter-weight stand-ins for `holistic` and `faiss` — upgrade to the full versions after Phase 4 is stable.
