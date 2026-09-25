# Training — Gemma 4 E2B QLoRA (51k multi-turn)

Published weights: [`CanisAI/teach-multilingual-gemma-4-e2b-r3`](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3)

Trained on the **default** Hugging Face config of [`CanisAI/teach-r3-multilingual`](https://huggingface.co/datasets/CanisAI/teach-r3-multilingual) — **51,870** multi-turn rows, `dialogue` field.

## Stack

- Base: `unsloth/gemma-4-E2B-unsloth-bnb-4bit`
- Unsloth QLoRA — `train.py` in this directory
- Production run: **A6000**, ~12 h (4080 Super projected ~1 week for full data)

## Smoke test

```bash
pip install -r requirements.txt
mkdir -p runs/smoke && cp run_spec.hf_config.example.json runs/smoke/run_spec.json
python train.py --run-spec runs/smoke/run_spec.json
```

## Full 51k run

Copy `run_spec.hf_config.example.json` → `runs/r3-51k/run_spec.json` and **remove** `max_samples` from the `dataset` block.

## Telemetry

The original Unsloth Studio run uploaded the adapter but **did not retain** loss CSVs. Re-run this script for your own curves.

## 161k single-turn run

A separate adapter was trained on the single-turn export; that artifact is **not** `teach-multilingual-gemma-4-e2b-r3`.
