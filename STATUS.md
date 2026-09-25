# Project Status

_Last updated: 25 September 2026_

## What's working

**Pipeline B (Sign → Output)**
- Webcam capture and hand landmark detection via MediaPipe (`mp.solutions.hands`, pinned to 0.10.14)
- Landmark vectors matched against a word dictionary using cosine similarity (`pipeline_b/candidate_search.py`)
- Full async data flow verified end-to-end: webcam → landmarks → match → output
- Output mode: console fallback (prints matched word + banner representation). Virtual camera output via `pyvirtualcam`/OBS is implemented but currently fails to start on this machine (OBS backend initializes but errors on camera start — not yet root-caused; likely a driver registration issue after fresh OBS install). Falls back cleanly to console output rather than crashing.

## Known limitations

- **Vocabulary is placeholder data.** The word dictionary in `candidate_search.py` uses random vectors, not real ASL sign embeddings. Matching logic works; the data behind it does not yet represent real sign language.
- **No grammar/fluency correction yet.** Matched words are output raw, not passed through an LLM to form fluent sentences.
- **Virtual camera output unreliable.** See above — falls back to console; not yet fixed.

## Not yet built

- **Pipeline A (Audio → Subtitle).** Not started. Planned: `sounddevice` WASAPI loopback capture → `faster-whisper` transcription → floating subtitle overlay (PyQt6).
- **LLM grammar correction (Pipeline B).** Blocked on a dependency conflict: the `canis-gemma4good` base model requires Unsloth's custom layers to attach the LoRA adapter correctly (standard `peft.PeftModel` fails on Unsloth's quantized layer types), and Unsloth requires `torch<2.13.0`, while CUDA support for this GPU needed a newer torch build. Environment work is in progress; adapter has not yet been successfully loaded with LoRA attached.
- **FAISS vector search.** MVP uses plain numpy cosine similarity over a 10-word dictionary. Swapping to FAISS is planned once real vocabulary data is in place — not worth doing against placeholder data yet.

## Architecture note

Pipeline components integrate external libraries (MediaPipe, pyvirtualcam, faster-whisper, PyQt6) as standard pip dependencies, with custom wrapper code in `pipeline_a/` and `pipeline_b/` calling their public APIs. Additionally, the source repositories for these stitched libraries are tracked as git submodules in the `vendor/` directory for reference, though the application runs using the `pip`/`requirements.txt` installations.

## Repo stitching map (original plan, for reference)

| Component | Repository | Integration method |
|---|---|---|
| System Audio Capture | spatialaudio/python-sounddevice | pip dependency + `vendor/python-sounddevice` submodule (Pipeline A pending) |
| STT Engine | SYSTRAN/faster-whisper | pip dependency + `vendor/faster-whisper` submodule (Pipeline A pending) |
| Transparent Overlay | PyQt6 | pip dependency (not yet used — Pipeline A pending) |
| Hand/Pose Landmarks | google-ai-edge/mediapipe | pip dependency + `vendor/mediapipe` submodule (in use) |
| Pose Normalization | sign-language-processing/pose | `vendor/pose-format` submodule (not yet integrated) |
| Vector Similarity | facebookresearch/faiss | `vendor/faiss` submodule (not yet integrated — plain numpy used in MVP) |
| Virtual Cam Output | letmaik/pyvirtualcam | pip dependency + `vendor/pyvirtualcam` submodule (failing to start) |
