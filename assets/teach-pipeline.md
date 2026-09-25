# TEACH pipeline (reference)

The **TEACH** pipeline orchestrates tutoring without per-subject LoRA routers. Every tutoring turn uses the single R3 adapter registered as **`teach`**.

```mermaid
flowchart TD
  A[Student message] --> B{entry classifier}
  B -->|task_request| C[extract_context from worksheet]
  B -->|clarification_response| D[resolve_clarification]
  B -->|continuation / general| E[teach_gen]
  C --> E
  D --> E
  B -->|casual| F[decline_casual]
  E --> G[(adapter: teach)]
  F --> G
  G --> H[llama-server :8080]
  H --> I[Socratic reply]
```

**Setup contract:** after `sync_canis_models_to_llama.ps1`, the LoRA file must exist at:

`canis-models/lora/teach/teach.gguf`

The Canis API applies `CANIS_TEACH_ADAPTER=teach` on startup. Pipeline definition: [`cli/examples/TEACH.json`](../cli/examples/TEACH.json).
