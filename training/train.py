"""
Headless Gemma 4 SFT on R3-style chat data using Unsloth (FastModel + train_on_responses_only).

Usage:
  python train_gemma4_r3.py --run-spec runs/<id>/run_spec.json

Expects Unsloth and CUDA inside `unsloth/unsloth` Docker image or a local Unsloth env.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _git_sha(cwd: Path) -> Optional[str]:
    try:
        return (
            subprocess.check_output(
                ["git", "rev-parse", "HEAD"],
                cwd=cwd,
                stderr=subprocess.DEVNULL,
                text=True,
            ).strip()
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def load_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, default=str)


def validate_run_spec(spec: Dict[str, Any]) -> None:
    for k in RUN_SPEC_REQUIRED_keys():
        if k not in spec:
            raise ValueError(f"run_spec missing required key: {k}")
    src = spec["dataset"]["source"]
    if src not in ("hf", "jsonl"):
        raise ValueError("dataset.source must be hf or jsonl")
    if src == "hf" and not spec["dataset"].get("hf_dataset_id"):
        raise ValueError("dataset.hf_dataset_id required when source=hf")
    if src == "jsonl" and not spec["dataset"].get("jsonl_path"):
        raise ValueError("dataset.jsonl_path required when source=jsonl")


def RUN_SPEC_REQUIRED_keys() -> List[str]:
    return ["run_id", "model_name", "chat_template", "dataset", "lora", "training", "output"]


def load_training_dataset(spec: Dict[str, Any]):
    from datasets import load_dataset

    dcfg = spec["dataset"]
    src = dcfg["source"]
    kw: Dict[str, Any] = {}
    if dcfg.get("hf_revision"):
        kw["revision"] = dcfg["hf_revision"]

    if src == "jsonl":
        path = dcfg["jsonl_path"]
        if not path:
            raise ValueError("jsonl_path required")
        ds = load_dataset("json", data_files=path, split="train")
    else:
        hf_id = dcfg.get("hf_dataset_id")
        data_files = dcfg.get("hf_data_files")
        config_name = dcfg.get("hf_config")
        split = dcfg.get("hf_split", "train")
        if data_files:
            ds = load_dataset(hf_id, data_files=data_files, split=split, **kw)
        elif config_name:
            ds = load_dataset(hf_id, config_name, split=split, **kw)
        else:
            ds = load_dataset(hf_id, split=split, **kw)

    max_samples = dcfg.get("max_samples")
    if max_samples is not None:
        n = min(int(max_samples), len(ds))
        ds = ds.select(range(n))
    return ds


def resolve_dialogue_field(ds, spec: Dict[str, Any]) -> str:
    """Pick the column holding chat turns (R3 canonical uses `dialogue`, hybrid slice uses `messages`)."""
    cols = set(ds.column_names)
    configured = spec["dataset"].get("messages_field")
    if configured in (None, "auto"):
        if "dialogue" in cols:
            return "dialogue"
        if "messages" in cols:
            return "messages"
        raise ValueError(
            "No `dialogue` or `messages` column. For CanisAI/teach-r3-multilingual use "
            "`messages_field`: `dialogue` (data/**.jsonl) or `messages` (hybrid slice)."
        )
    if configured not in cols:
        raise ValueError(
            f"dataset.messages_field={configured!r} not in columns {sorted(cols)}. "
            "Canonical R3 multi-turn: `dialogue`. Hybrid slice: `messages`."
        )
    return configured


def ensure_conversations_column(ds, spec: Dict[str, Any]):
    def normalize_messages(msgs: Any) -> List[Dict[str, Any]]:
        if isinstance(msgs, str):
            msgs = json.loads(msgs)
        conv = []
        for m in msgs:
            role = m["role"]
            content = m["content"]
            if isinstance(content, list):
                texts = [
                    p.get("text", "")
                    for p in content
                    if isinstance(p, dict) and p.get("type") == "text"
                ]
                content = " ".join(texts).strip()
            conv.append({"role": role, "content": content})
        return conv

    cols = ds.column_names
    if "conversations" in cols:
        return ds

    field = resolve_dialogue_field(ds, spec)

    def _map_batch(examples):
        convos = []
        for msgs in examples[field]:
            convos.append(normalize_messages(msgs))
        return {"conversations": convos}

    return ds.map(_map_batch, batched=True)


def try_standardize(ds):
    try:
        from unsloth.chat_templates import standardize_data_formats

        return standardize_data_formats(ds)
    except Exception:
        return ds


def write_failed_manifest(run_dir: Path, spec: Dict[str, Any], err: str) -> None:
    manifest = {
        "run_id": spec.get("run_id", run_dir.name),
        "completed_at": _utc_now_iso(),
        "status": "failed",
        "error": err,
        "model_name": spec.get("model_name"),
        "chat_template": spec.get("chat_template"),
        "enable_thinking": spec.get("enable_thinking", False),
        "lora_path": str(run_dir / spec.get("output", {}).get("lora_subdir", "lora")),
        "run_spec": spec,
    }
    save_json(run_dir / "manifest.json", manifest)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--run-spec",
        type=Path,
        required=True,
        help="Path to run_spec.json (usually runs/<id>/run_spec.json)",
    )
    args = parser.parse_args()
    run_spec_path = args.run_spec.resolve()
    spec = load_json(run_spec_path)
    validate_run_spec(spec)

    run_dir = run_spec_path.parent
    if spec["run_id"] != run_dir.name:
        print(
            f"Warning: run_spec.run_id ({spec['run_id']}) != parent dir name ({run_dir.name}).",
            file=sys.stderr,
        )

    save_json(run_dir / "run_spec.resolved.json", spec)

    try:
        import unsloth  # noqa: F401
        from unsloth import FastModel
        from unsloth.chat_templates import (
            get_chat_template,
            train_on_responses_only,
        )
        from trl import SFTConfig, SFTTrainer
    except ImportError as e:
        print(
            "Unsloth / TRL not available. Run inside `unsloth/unsloth` Docker or install scripts/requirements-train.txt",
            file=sys.stderr,
        )
        write_failed_manifest(run_dir, spec, f"import_error: {e}")
        return 1

    unsloth_ver = getattr(unsloth, "__version__", None)

    max_seq = spec.get("max_seq_length", 8192)
    model_name = spec["model_name"]
    chat_template_name = spec["chat_template"]
    enable_thinking = bool(spec.get("enable_thinking", False))

    print(f"Loading dataset…")
    raw_ds = load_training_dataset(spec)
    ds = ensure_conversations_column(raw_ds, spec)
    ds = try_standardize(ds)

    print(f"Loading model {model_name} …")
    model, tokenizer = FastModel.from_pretrained(
        model_name=model_name,
        dtype=None,
        max_seq_length=max_seq,
        load_in_4bit=True,
        full_finetuning=False,
    )

    tokenizer = get_chat_template(tokenizer, chat_template=chat_template_name)

    def formatting_prompts_func(examples):
        convos = examples["conversations"]
        texts = []
        for convo in convos:
            t = tokenizer.apply_chat_template(
                convo,
                tokenize=False,
                add_generation_prompt=False,
                enable_thinking=enable_thinking,
            )
            if t.startswith("<bos>"):
                t = t[len("<bos>") :]
            texts.append(t)
        return {"text": texts}

    print("Mapping chat template…")
    dataset = ds.map(formatting_prompts_func, batched=True)

    lcfg = spec["lora"]
    model = FastModel.get_peft_model(
        model,
        finetune_vision_layers=False,
        finetune_language_layers=True,
        finetune_attention_modules=True,
        finetune_mlp_modules=True,
        r=lcfg["r"],
        lora_alpha=lcfg["lora_alpha"],
        lora_dropout=lcfg.get("lora_dropout", 0),
        bias="none",
        random_state=spec["training"]["seed"],
    )

    tcfg = spec["training"]
    lora_dir = run_dir / spec["output"]["lora_subdir"]
    lora_dir.mkdir(parents=True, exist_ok=True)

    sft_args = SFTConfig(
        dataset_text_field="text",
        per_device_train_batch_size=tcfg.get("per_device_train_batch_size", 1),
        gradient_accumulation_steps=tcfg.get("gradient_accumulation_steps", 4),
        warmup_steps=tcfg.get("warmup_steps", 5),
        max_steps=tcfg["max_steps"],
        learning_rate=tcfg["learning_rate"],
        logging_steps=tcfg.get("logging_steps", 1),
        optim=tcfg.get("optim", "adamw_8bit"),
        weight_decay=0.001,
        lr_scheduler_type="linear",
        seed=tcfg["seed"],
        output_dir=str(lora_dir),
        report_to=tcfg.get("report_to", "none"),
        save_steps=tcfg["max_steps"],
        save_strategy="steps",
    )

    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=dataset,
        eval_dataset=None,
        args=sft_args,
    )

    trainer = train_on_responses_only(
        trainer,
        instruction_part="<|turn>user\n",
        response_part="<|turn>model\n",
    )

    print("Training…")
    train_result = trainer.train()

    metrics: Dict[str, Any] = {
        "train_samples": len(dataset),
        "total_steps": tcfg["max_steps"],
    }
    if hasattr(train_result, "metrics") and train_result.metrics:
        metrics.update(dict(train_result.metrics))
    elif hasattr(train_result, "training_loss"):
        metrics["training_loss"] = train_result.training_loss

    save_json(run_dir / "metrics.json", metrics)

    repo_root = run_spec_path
    for _ in range(8):
        if (repo_root / ".git").is_dir():
            break
        repo_root = repo_root.parent

    manifest: Dict[str, Any] = {
        "run_id": spec["run_id"],
        "completed_at": _utc_now_iso(),
        "status": "completed",
        "model_name": model_name,
        "chat_template": chat_template_name,
        "enable_thinking": enable_thinking,
        "max_seq_length": max_seq,
        "lora_path": str(lora_dir.resolve()),
        "metrics_path": str((run_dir / "metrics.json").resolve()),
        "metrics": metrics,
        "git_sha": _git_sha(repo_root),
        "docker_image": os.environ.get("UNSLOTH_DOCKER_IMAGE"),
        "docker_image_digest": os.environ.get("DOCKER_IMAGE_DIGEST"),
        "hf_dataset_revision": spec["dataset"].get("hf_revision"),
        "unsloth_version": unsloth_ver,
        "run_spec": spec,
    }
    save_json(run_dir / "manifest.json", manifest)
    print(f"Done. LoRA: {lora_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(traceback.format_exc(), file=sys.stderr)
        try:
            rs = Path(sys.argv[sys.argv.index("--run-spec") + 1])
            spec = load_json(rs)
            write_failed_manifest(rs.parent, spec, str(e))
        except Exception:
            pass
        raise SystemExit(1)
