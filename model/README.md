# Model — teach-multilingual-gemma-4-e2b-r3

| Artifact | URL |
|----------|-----|
| Published adapter (**51k multi-turn**) | [`CanisAI/teach-multilingual-gemma-4-e2b-r3`](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3) |
| Base (training) | [`unsloth/gemma-4-E2B-unsloth-bnb-4bit`](https://huggingface.co/unsloth/gemma-4-E2B-unsloth-bnb-4bit) |
| Dataset | [`CanisAI/teach-r3-multilingual`](https://huggingface.co/datasets/CanisAI/teach-r3-multilingual) |

A separate adapter was trained on the **161k single-turn** export; it is not the published 51k model.

## Files

| File | Purpose |
|------|---------|
| [`load_adapter.py`](load_adapter.py) | Hugging Face + PEFT one-prompt demo |
| [`../cli/`](../cli/) | Edge inference: `llama-server` + Canis TEACH pipeline — see [`../cli/EDGE_SETUP.md`](../cli/EDGE_SETUP.md) |
