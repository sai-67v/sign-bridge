#!/usr/bin/env python3
"""
Minimal example: load Gemma 4 + Canis R3 LoRA and run one Socratic prompt.

Requires: pip install torch transformers peft accelerate
HF_TOKEN if the adapter repo is gated.

Usage:
  python load_adapter.py
  python load_adapter.py --prompt "bro idk what c is in this triangle thing"
"""
from __future__ import annotations

import argparse

BASE_MODEL = "unsloth/gemma-4-E2B-unsloth-bnb-4bit"
ADAPTER_REPO = "CanisAI/teach-multilingual-gemma-4-e2b-r3"
SYSTEM = (
    "You are a supportive K-12 tutor. Use Socratic questioning, scaffold reasoning, "
    "and avoid giving the final answer directly. Keep responses age-appropriate and concise."
)
DEFAULT_PROMPT = "hey kannst du mir einfach die lösung für aufgabe 3 schicken ich hab keine lust mehr"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default=BASE_MODEL)
    parser.add_argument("--adapter", default=ADAPTER_REPO)
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument("--max-new-tokens", type=int, default=256)
    args = parser.parse_args()

    import torch
    from peft import PeftModel
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(args.base, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        args.base,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        trust_remote_code=True,
    )
    model = PeftModel.from_pretrained(base_model, args.adapter)
    model.eval()

    messages = [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": args.prompt},
    ]
    if hasattr(tokenizer, "apply_chat_template"):
        text = tokenizer.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
    else:
        text = f"{SYSTEM}\n\nUser: {args.prompt}\nAssistant:"

    inputs = tokenizer(text, return_tensors="pt").to(model.device)
    with torch.no_grad():
        out = model.generate(
            **inputs,
            max_new_tokens=args.max_new_tokens,
            do_sample=True,
            temperature=0.7,
            top_p=0.9,
        )
    reply = tokenizer.decode(out[0][inputs["input_ids"].shape[-1] :], skip_special_tokens=True)
    print("--- prompt ---")
    print(args.prompt)
    print("--- reply ---")
    print(reply.strip())


if __name__ == "__main__":
    main()
