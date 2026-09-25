#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pipeline_b/candidate_search.py
───────────────────────────────
Takes a list of 21 mediapipe NormalizedLandmark objects (one hand),
encodes them as a flat numpy vector, and cosine-matches against a
hardcoded 10-word vocabulary using pure numpy (no FAISS).

Returns the best-matching word string.

NOTE: The hardcoded landmark vectors below are PLACEHOLDER/RANDOM seeds.
They are intentionally not real ASL measurements — this module is wired
for the demo pipeline and will be replaced with real embeddings in a
later sprint once we have a labelled landmark dataset.

Standalone smoke-test:
    python pipeline_b/candidate_search.py
"""
from __future__ import annotations

import asyncio
import sys
from typing import List, Optional

import numpy as np
import faiss

# ── Vocabulary ────────────────────────────────────────────────────────────
# 10 words. Each entry is a (543×3,) = 1629-dimensional placeholder embedding.
# Real implementation: replace with mean landmark vectors extracted from a
# per-word dataset of recorded signs.
_VOCAB_WORDS: List[str] = [
    "hello",
    "help",
    "yes",
    "no",
    "please",
    "thank you",
    "sorry",
    "where",
    "food",
    "water",
]

# Seeded random unit-vectors as placeholder embeddings (reproducible)
_rng = np.random.default_rng(seed=42)
_raw = _rng.standard_normal((len(_VOCAB_WORDS), 1629)).astype(np.float32)
faiss.normalize_L2(_raw)
_VOCAB_VECTORS: np.ndarray = _raw

# Build FAISS IndexFlatIP (Inner Product / Cosine Similarity)
_dimension = 1629
_index = faiss.IndexFlatIP(_dimension)
_index.add(_VOCAB_VECTORS)


def _landmarks_to_vector(landmarks) -> np.ndarray:
    """
    Flatten a mediapipe NormalizedLandmark list into a 1629-d numpy vector
    and L2-normalise it.

    landmarks: list[mediapipe NormalizedLandmark]  (543 items)
    """
    coords = np.array(
        [[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32
    ).flatten()  # shape: (1629,)

    # Normalize wrist to origin so position-invariant (assuming index 0 is center)
    center = coords[:3].copy()
    coords = coords.reshape(543, 3) - center
    coords = coords.flatten()
    
    # Reshape for faiss normalize
    coords_2d = coords.reshape(1, -1)
    faiss.normalize_L2(coords_2d)
    return coords_2d


def best_match(landmarks) -> str:
    """
    Given a list of 543 mediapipe NormalizedLandmark objects, return the
    best-matching word from the vocabulary using FAISS cosine similarity.
    """
    query = _landmarks_to_vector(landmarks)
    distances, indices = _index.search(query, k=1)
    best_idx = indices[0][0]
    return _VOCAB_WORDS[best_idx]


class CandidateSearch:
    """
    Async wrapper: consumes landmarks from one queue, writes matched words
    to another queue.
    """

    def __init__(
        self,
        landmark_queue: asyncio.Queue,
        word_queue: asyncio.Queue,
    ) -> None:
        self.landmark_queue = landmark_queue
        self.word_queue = word_queue
        self._running = False

    async def run(self) -> None:
        self._running = True
        while self._running:
            try:
                landmarks = self.landmark_queue.get_nowait()
                word = best_match(landmarks)
                try:
                    self.word_queue.put_nowait(word)
                except asyncio.QueueFull:
                    pass
            except asyncio.QueueEmpty:
                await asyncio.sleep(0.01)

    def stop(self) -> None:
        self._running = False


# ── standalone smoke-test ─────────────────────────────────────────────────
if __name__ == "__main__":
    print("Candidate search smoke-test — generating 5 random landmark sets")
    print(f"Vocabulary: {_VOCAB_WORDS}")
    print()
    rng = np.random.default_rng()
    for i in range(5):
        # Fake landmark objects with .x .y .z attributes
        class _FakeLM:
            def __init__(self, x, y, z):
                self.x, self.y, self.z = float(x), float(y), float(z)

        fake = [_FakeLM(*rng.random(3)) for _ in range(543)]
        word = best_match(fake)
        print(f"  Test {i+1}: best match -> \"{word}\"")
    print()
    print("Smoke-test done. Wire landmark_extractor.py output into best_match() for live results.")
