#!/usr/bin/env python3
from __future__ import annotations
"""
pipeline_b/run.py
──────────────────
Full Pipeline B entry point — wires landmark_extractor → candidate_search
→ virtual_camera into a single asyncio.gather() loop.

Grammar correction via LoRA adapter is a documented NEXT STEP.
Today's demo outputs the raw cosine-matched word directly to the camera.

Run:
    python -m pipeline_b.run
  or:
    python pipeline_b/run.py

Press Ctrl+C to stop.
"""
import io
import sys

# Ensure UTF-8 output on Windows (cp1252 console can't encode arrows/dashes)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import asyncio
import signal


from pipeline_b.landmark_extractor import LandmarkExtractor
from pipeline_b.candidate_search   import CandidateSearch
from pipeline_b.grammar_corrector  import GrammarCorrector
from pipeline_b.virtual_camera     import VirtualCamera


async def main() -> None:
    print("=" * 60)
    print("  Pipeline B -- Sign -> Virtual Camera (MVP demo)")
    print("  Grammar correction: ACTIVE (LoRA adapter wired)")
    print("=" * 60)
    print()

    # Shared queues
    landmark_queue: asyncio.Queue = asyncio.Queue(maxsize=5)
    word_queue:     asyncio.Queue = asyncio.Queue(maxsize=5)
    sentence_queue: asyncio.Queue = asyncio.Queue(maxsize=5)

    # Component instances
    extractor = LandmarkExtractor(landmark_queue)
    searcher  = CandidateSearch(landmark_queue, word_queue)
    corrector = GrammarCorrector(word_queue, sentence_queue)
    camera    = VirtualCamera(sentence_queue)

    # Graceful shutdown on Ctrl+C
    loop = asyncio.get_event_loop()

    def _shutdown() -> None:
        print("\nShutting down…")
        extractor.stop()
        searcher.stop()
        corrector.stop()
        camera.stop()

    if sys.platform != "win32":
        loop.add_signal_handler(signal.SIGINT,  _shutdown)
        loop.add_signal_handler(signal.SIGTERM, _shutdown)

    print("Starting pipeline (Ctrl+C to stop)…")
    try:
        await asyncio.gather(
            extractor.run(),
            searcher.run(),
            corrector.run(),
            camera.run(),
        )
    except (asyncio.CancelledError, KeyboardInterrupt):
        _shutdown()
        print("Pipeline B stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
