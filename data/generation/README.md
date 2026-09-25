# R3 data generation — Gemma 4 + Canis.lab

The [**teach-r3-multilingual**](https://huggingface.co/datasets/CanisAI/teach-r3-multilingual) dataset was produced with:

| Component | Role |
|-----------|------|
| **Canis.lab** | Seed Architect + Workflow Editor — dialogue seeds, expansion, quality gates, export to JSONL |
| **Gemma 4 26B A4B-IT** | Generator model on **NVIDIA DGX Spark** (Ollama × NVIDIA GTC Golden Ticket) |
| **R3 seed schema v6** | Student turns in **register-realistic** style; tutor turns Socratic |

## Canis.lab

Canis.lab is the public Streamlit toolchain for synthetic tutoring data:

- Releases: https://github.com/crasyK/Canis.lab
- Typical workflow: author seeds → expand via workflows → export JSONL → upload to Hugging Face

This mirror does **not** vendor the full LAB application (large UI + dependencies). Use Canis.lab releases or your own generation pipeline.

## Gemma 4 loop

Generation used **Gemma 4 26B**; the published adapter [`teach-multilingual-gemma-4-e2b-r3`](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3) fine-tunes **Gemma 4 E2B** on the 51k multi-turn split.

## Published training data

| Slice | Scale | Published adapter? |
|-------|--------|-------------------|
| Multi-turn `dialogue` | **51,870** | **Yes** |
| Single-turn pairs | **161,169** | Separate training run (different weights) |

## Register motivation (research)

Short, messy student language was observed in the **R1 research A/B** ([`lesson/`](../lesson/), Canis paper). R3 **generation** targets that distribution synthetically—not a claim of live R3/Studio field trials.
