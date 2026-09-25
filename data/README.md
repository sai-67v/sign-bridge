# Data — Canis.teach R3

**Hub:** https://huggingface.co/datasets/CanisAI/teach-r3-multilingual

| Metric | Value |
|--------|--------|
| Multi-turn dialogues | **51,870** |
| Languages | en, de, uk, fr, es, it |
| Subjects | math, science, language_arts, humanities |
| Single-turn pairs | 161,169 (separate training export) |

## How it was built

See **[`generation/README.md`](generation/README.md)** — **Gemma 4 26B** + **Canis.lab**.

## Published model uses

The hackathon adapter [`CanisAI/teach-multilingual-gemma-4-e2b-r3`](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3) was trained on the **51k multi-turn** config (`dialogue` field).

## Sample rows

[`sample_50.jsonl`](sample_50.jsonl) — DE-style evaluation prompts for quick inspection (not training shards).

## License

Apache-2.0 on the dataset card + [Gemma Terms](https://ai.google.dev/gemma/terms) for generated content. **Adaptive Data / Adaption** credit on derivatives per the dataset card.
