#!/usr/bin/env python3
"""
pipeline_b/test_corrector.py
────────────────────────────
Smoke-test: pass sign-language word sequences through the Canis R3 adapter
using a grammar-correction system prompt (NOT the tutor SYSTEM from
load_adapter.py) to check for Socratic leakage before the live pipeline
integration.

Run from the repo root:
    python -m pipeline_b.test_corrector
  or:
    python pipeline_b/test_corrector.py

Requires the same deps as model/load_adapter.py:
    pip install torch transformers peft accelerate
"""
from __future__ import annotations

import sys
import textwrap
import time
from pathlib import Path
from typing import List

# ── Safely import only the model/adapter IDs from load_adapter.
# load_adapter.py puts all heavy imports inside main(), so this import does
# NOT load torch/transformers — it only pulls the two string constants.
# We deliberately do NOT import SYSTEM from there; we override it here.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # repo root → sys.path
from model.load_adapter import BASE_MODEL, ADAPTER_REPO  # noqa: E402

# ── Override: grammar-correction-only system prompt ────────────────────────
SYSTEM = (
    "You convert sign-language word sequences into a single fluent English sentence. "
    "Output ONLY the sentence. No questions, no explanations, no commentary, "
    "no markdown, no prefixes — just the sentence itself."
)

# ── Test inputs ────────────────────────────────────────────────────────────
test_inputs: List[List[str]] = [
    ["hello", "how", "are"],
    ["i", "want", "eat", "food"],
    ["thank", "you", "help"],
    ["where", "bathroom"],
    ["my", "name", "is", "john"],
]

# ── Leakage heuristics (post-generation check) ─────────────────────────────
_LEAKAGE_MARKERS = [
    "?",              # follow-up questions
    "what do you",
    "can you tell",
    "why do you",
    "how do you",
    "think about",
    "let me know",
    "great question",
    "let's",
    "let me",
    "i'd like to",
    "i would like to",
    "as a tutor",
    "scaffold",
    "socratic",
    "good try",
    "well done",
    "you might",
    "perhaps",
    "consider",
    "**",              # markdown bold leak
    "- ",              # markdown list leak
    "\n\n",            # multi-paragraph (explanation leak)
]


def check_leakage(text: str) -> List[str]:
    """Return a list of leakage markers found in the output (lowercased)."""
    lower = text.lower()
    return [m for m in _LEAKAGE_MARKERS if m in lower]


def format_input(words: List[str]) -> str:
    """Convert a word list to the user message sent to the model."""
    return " ".join(words)


def run_inference(model, tokenizer, user_text: str, max_new_tokens: int = 64) -> str:
    """Run a single deterministic inference pass and return the decoded reply."""
    import torch

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user",   "content": user_text},
    ]

    if hasattr(tokenizer, "apply_chat_template"):
        text = tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    else:
        # Fallback for tokenizers without chat-template support
        text = f"{SYSTEM}\n\nUser: {user_text}\nAssistant:"

    inputs = tokenizer(text, return_tensors="pt").to(model.device)

    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=max_new_tokens,
            do_sample=False,          # deterministic — no temperature/top_p
            # do_sample=False makes temperature/top_p irrelevant; omitting them
            # avoids UserWarnings from transformers.
        )

    # Slice off the prompt tokens, decode only the generated reply
    reply_ids = out[0][inputs["input_ids"].shape[-1]:]
    return tokenizer.decode(reply_ids, skip_special_tokens=True)


def main() -> None:
    print("=" * 70)
    print("  Canis R3 — Sign Sequence Corrector  |  Socratic-Leakage Test")
    print("=" * 70)
    print(f"  Base model  : {BASE_MODEL}")
    print(f"  Adapter     : {ADAPTER_REPO}")
    print(f"  Sampling    : do_sample=False  (deterministic)")
    print(f"  System prompt (override):")
    for line in textwrap.wrap(SYSTEM, width=64):
        print(f"    {line}")
    print("=" * 70)
    print()

    # Heavy imports — inside main() so a bare `import pipeline_b.test_corrector`
    # doesn't load torch/transformers.
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import PeftModel

    print("Loading base model and adapter via standard Hugging Face PEFT…")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    base_model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16
    )

    model = PeftModel.from_pretrained(base_model, ADAPTER_REPO)
    model.eval()

    device_label = str(next(model.parameters()).device)
    print(f"Model loaded on: {device_label}")
    print()
    import subprocess
    print("--- GPU VRAM AFTER MODEL LOAD ---")
    subprocess.run(["nvidia-smi"])
    print("---------------------------------")
    print()

    # ── Run each test input ────────────────────────────────────────────────
    leakage_summary: List[tuple] = []

    for idx, words in enumerate(test_inputs, start=1):
        user_text = format_input(words)
        print(f"[{idx}/{len(test_inputs)}] Input words : {words}")
        print(f"          User message: \"{user_text}\"")

        t0 = time.perf_counter()
        reply = run_inference(model, tokenizer, user_text)
        elapsed = time.perf_counter() - t0

        print(f"          Raw output   : \"{reply.strip()}\"")
        print(f"          Inference    : {elapsed:.2f}s")

        leaks = check_leakage(reply)
        if leaks:
            print(f"          ⚠ LEAKAGE DETECTED — markers: {leaks}")
            leakage_summary.append((idx, words, leaks))
        else:
            print(f"          ✓ No leakage markers detected")

        print()

    # ── Summary ────────────────────────────────────────────────────────────
    print("=" * 70)
    if leakage_summary:
        print(f"  ⚠  LEAKAGE in {len(leakage_summary)}/{len(test_inputs)} outputs:")
        for idx, words, leaks in leakage_summary:
            print(f"     [{idx}] {words}  →  markers: {leaks}")
        print()
        print("  Action: the Socratic weight bias is leaking through.")
        print("  Consider adding 'no questions' reinforcement or using a")
        print("  post-processing step to strip trailing sentences with '?'.")
    else:
        print(f"  ✓  All {len(test_inputs)} outputs clean — no Socratic leakage detected.")
        print("  Safe to wire into the live pipeline.")
    print("=" * 70)


if __name__ == "__main__":
    main()
