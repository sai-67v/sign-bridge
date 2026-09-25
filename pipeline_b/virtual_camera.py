#!/usr/bin/env python3
"""
pipeline_b/virtual_camera.py
─────────────────────────────
Reads matched words from an asyncio.Queue and broadcasts each frame
via pyvirtualcam so the word appears as a banner on the virtual camera.

The virtual camera output can be selected as a camera source in any
video-call app (Zoom, Teams, OBS, etc.).

Prerequisites:
  - Install OBS Virtual Camera (Windows) or v4l2loopback (Linux) so that
    pyvirtualcam has a device to write to.
  - pip install pyvirtualcam opencv-python

Standalone smoke-test (no physical webcam needed):
    python pipeline_b/virtual_camera.py
    → cycles through demo words for 10 seconds on the virtual camera.

Full pipeline entry point:
    python -m pipeline_b.run   (see pipeline_b/run.py — Phase 4)
"""
from __future__ import annotations

import asyncio
import time
from typing import Optional

import cv2
import numpy as np
import pyvirtualcam

# ── Config ────────────────────────────────────────────────────────────────
WIDTH  = 1280
HEIGHT = 720
FPS    = 30

# Banner appearance
BANNER_HEIGHT    = 100          # px from bottom
BANNER_COLOR_BGR = (30, 30, 30) # dark charcoal
TEXT_COLOR_BGR   = (255, 255, 255)
FONT             = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE       = 2.0
FONT_THICKNESS   = 3


def _build_frame(word: Optional[str]) -> np.ndarray:
    """
    Produce a WIDTH×HEIGHT RGBA numpy frame with a bottom banner
    showing the current matched word (or a waiting message).
    """
    # Black background
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)

    # Banner strip
    banner_y = HEIGHT - BANNER_HEIGHT
    frame[banner_y:, :] = BANNER_COLOR_BGR

    # Word text centred in banner
    label = word if word else "…waiting for sign…"
    (tw, th), _ = cv2.getTextSize(label, FONT, FONT_SCALE, FONT_THICKNESS)
    tx = (WIDTH  - tw) // 2
    ty = banner_y + (BANNER_HEIGHT + th) // 2

    cv2.putText(
        frame, label,
        (tx, ty),
        FONT, FONT_SCALE,
        TEXT_COLOR_BGR, FONT_THICKNESS,
        cv2.LINE_AA,
    )

    # pyvirtualcam expects RGB, not BGR
    return cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)


class VirtualCamera:
    """
    Async broadcaster: reads words from word_queue and pushes frames to
    the virtual camera at FPS rate.
    """

    def __init__(self, word_queue: asyncio.Queue) -> None:
        self.word_queue = word_queue
        self._running   = False
        self._current_word: Optional[str] = None

    async def run(self) -> None:
        self._running = True
        frame_interval = 1.0 / FPS

        try:
            cam_ctx = pyvirtualcam.Camera(
                width=WIDTH, height=HEIGHT, fps=FPS, print_fps=False
            )
        except RuntimeError as exc:
            # ── Console-only fallback (no OBS / unitycapture installed) ──────
            print(f"[VirtualCamera] No virtual camera device found ({exc})")
            print("[VirtualCamera] Falling back to console-only mode.")
            print("[VirtualCamera] Words will be printed as [BANNER] <word>.\n")
            await self._run_console_fallback(frame_interval)
            return

        # ── Real virtual-camera path ─────────────────────────────────────────
        with cam_ctx as cam:
            print(f"[VirtualCamera] Active on device: {cam.device}")
            while self._running:
                t0 = time.perf_counter()

                # Drain queue — keep only the latest word if several arrived
                try:
                    while True:
                        self._current_word = self.word_queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

                frame = _build_frame(self._current_word)
                cam.send(frame)
                cam.sleep_until_next_frame()

                elapsed = time.perf_counter() - t0
                await asyncio.sleep(max(0, frame_interval - elapsed))

    async def _run_console_fallback(self, frame_interval: float) -> None:
        """Print matched words to stdout instead of pushing frames to a device."""
        last_printed: Optional[str] = None
        while self._running:
            t0 = time.perf_counter()

            # Drain queue
            try:
                while True:
                    self._current_word = self.word_queue.get_nowait()
            except asyncio.QueueEmpty:
                pass

            # Only print when the word changes to avoid terminal spam
            if self._current_word and self._current_word != last_printed:
                label = self._current_word
                print(f"[BANNER] {label}")
                last_printed = label

            elapsed = time.perf_counter() - t0
            await asyncio.sleep(max(0, frame_interval - elapsed))

    def stop(self) -> None:
        self._running = False


# ── standalone smoke-test ─────────────────────────────────────────────────
if __name__ == "__main__":
    DEMO_WORDS = ["hello", "help", "yes", "no", "please", "thank you",
                  "sorry", "where", "food", "water"]

    async def _smoke_test() -> None:
        print("Virtual camera smoke-test — 10 seconds")
        print("Select the virtual camera in OBS / Zoom to see the banner.")
        print()
        q: asyncio.Queue = asyncio.Queue(maxsize=10)
        cam_task = asyncio.create_task(VirtualCamera(q).run())

        start = time.perf_counter()
        for word in DEMO_WORDS * 3:
            if time.perf_counter() - start > 10:
                break
            await q.put(word)
            await asyncio.sleep(1.0)

        cam_task.cancel()
        print("Smoke-test done.")

    asyncio.run(_smoke_test())
