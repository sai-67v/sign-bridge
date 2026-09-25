# Canis, Bringing Connection Back to the Classroom

**Subtitle:** A Socratic, fine-tuned Gemma 4 tutor and an open classroom platform that puts the teacher in charge of how AI is used in the room.

**Track:** Future of Education · Special Technology: Unsloth, llama.cpp

**Video:** https://www.youtube.com/watch?v=QbxPs0jLiZY

## Motivation

Walk into a classroom in 2026 and look at what students do when they don't understand something. They don't ask the teacher. They open another tab. ChatGPT writes the answer, they copy it down, the worksheet gets handed in. The teacher stands in front of the room and sees attentive faces, but the actual learning loop has moved into a chat window they have no visibility into and no authority over.

The teacher I built the first version of Canis for described this as "a classroom full of silicone walls." Not students refusing to learn. Students who have been given a tool that is very good at producing answers and very bad at producing understanding, and no one ever told them the difference.

Canis is the response: a small **Gemma 4** model that behaves like a Socratic tutor, can run on a school PC via **llama.cpp**, and is meant to be reached through **Canis Studio**—a platform the teacher controls.

## Solution

Three pieces in this repository:

1. **Canis R3 adapter** — QLoRA on **Gemma 4 E2B**, trained on **51,870** multi-turn Socratic dialogues in realistic student register. Published as [`CanisAI/teach-multilingual-gemma-4-e2b-r3`](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3).
2. **`cli/`** — Canis CLI and server integration for **llama-server** on a teacher machine (local network, no cloud inference).
3. **`studio/`** — **Canis Studio** source (notes, classes, worksheets, AI sidebar). Live demo: https://canis.appwrite.network

## Why Gemma 4

The R3 **dataset** and the published R3 **adapter** are both Gemma 4 end to end.

- **Generation:** **Gemma 4 26B A4B-IT** on a DGX Spark (Ollama × NVIDIA GTC Golden Ticket), orchestrated through **Canis.lab** seed and workflow tooling ([`data/generation/README.md`](data/generation/README.md)).
- **Fine-tune:** **Gemma 4 E2B** via Unsloth (`unsloth/gemma-4-E2B-unsloth-bnb-4bit`).

Same family, same tokenizer, same chat format—one pipeline from synthetic data to classroom-sized weights.

## Development process

### From exam grader to tutor

The project began as an LLM for grading exams. Teachers were polite; students were already using ChatGPT for homework. The pivot: build the chatbot students reach for—but train it to **teach**, not to **answer**.

### R1 and R2 vs R3 (synthetic data)

Early rounds (R1, R2) produced clean, polite student turns. Offline scores looked fine; they did not match how students actually wrote in our **research** setting.

**R3** rewrote generation seeds so **student** turns are short, abbreviated, multilingual, and messy, while **tutor** turns stay Socratic. That corpus is [`CanisAI/teach-r3-multilingual`](https://huggingface.co/datasets/CanisAI/teach-r3-multilingual).

### Evidence: R1 research A/B (not an R3 or Studio pilot)

**Important:** There was **no classroom pilot of the R3 adapter** and **no field study of Canis Studio**. The empirical work in the Canis **paper** is an **R1-era A/B** comparing base vs math-specialized vs generalist small models, using the tools in [`lesson/`](lesson/) (data collection, classification, analysis).

From that study (aggregate, de-identified—see paper and `lesson/`):

- **265** logged student turns in the research session
- **Median ~6 words** per student message; short, task-help style common
- When filtering to learning-oriented interactions, the **general** cross-domain model outperformed the **math-only** specialist—motivating cross-domain Socratic training for R3

Those numbers informed **R3 dataset design**; they are **not** a claim that the published Gemma 4 R3 adapter was validated in a live Studio deployment.

### Training the published adapter

- **Data:** full **51k multi-turn** split (not a small curated slice).
- **Hardware:** started on RTX 4080 Super; projected wall-clock was impractical for the full run → rented **A6000**, ~**12 hours**, Unsloth QLoRA.
- **Output:** [`CanisAI/teach-multilingual-gemma-4-e2b-r3`](https://huggingface.co/CanisAI/teach-multilingual-gemma-4-e2b-r3).
- **Also trained:** a separate run on the **161k single-turn** export; that adapter is **not** the published 51k model.
- **Telemetry:** Unsloth Studio upload succeeded; **loss logs were not retained**. No charts are fabricated; [`training/`](training/) is reproducible.

### Studio + llama.cpp (design intent)

A weights file on Hugging Face does not replace ChatGPT. **Canis Studio** is the browser surface; **`cli/`** documents serving **Gemma 4 + R3** with **llama-server** on one school PC. That is the llama.cpp track: Gemma 4 on constrained hardware, class on the LAN.

## Hackathon tracks

- **Future of Education** — Socratic Gemma 4 tutor + open Studio + teacher-control narrative (demo + architecture; R1 research for register evidence).
- **Unsloth** — Full E2B QLoRA config in [`training/`](training/).
- **llama.cpp** — Production path via [`cli/`](cli/) and [`model/`](model/).

## Limitations

- No R3 or Studio classroom efficacy study in this submission.
- R3 data is synthetic (Gemma 4 + Canis.lab).
- Training loss curves not published (re-run training for your own).
- Hosted Studio demo ≠ certified school IT product.

## Outlook

Per-teacher and per-student adapters; Studio as MCP host for school-owned models; native context from notes and worksheets; tighter Studio ↔ local `llama-server` automation.

## Acknowledgements

Teachers and students in the **R1 research study**; Unsloth; Ollama and NVIDIA (GTC Golden Ticket); Appwrite (Studio hosting); Google Gemma team.
