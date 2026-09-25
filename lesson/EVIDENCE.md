# Research evidence (R1 A/B) — not R3 / Studio pilots

This folder contains the **LESSON** research toolchain used for the Canis **paper** study.

## What this is

- **R1-era** comparison: base chat model vs math-specialized ELM vs generalist ELM
- Gradio apps for collection, A/B pipeline testing, manual classification, and analysis
- Documented in [`README.md`](README.md#research-context)

## What this is not

- **Not** a classroom evaluation of `CanisAI/teach-multilingual-gemma-4-e2b-r3`
- **Not** a field trial of Canis Studio

R3 dataset **design** (messy student register) was informed by aggregate findings from this research (e.g. short student messages). See the paper and [`WRITEUP.md`](../WRITEUP.md).

## Privacy

Raw conversation CSVs and databases are **excluded** from git. Do not commit PII.

## Reproduce analysis (if you have local data)

Follow [`README.md`](README.md) — requires local `.env`, SQLite DB, or combined CSVs you hold under your ethics agreement.
