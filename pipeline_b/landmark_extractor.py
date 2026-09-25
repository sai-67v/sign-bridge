#!/usr/bin/env python3
"""
pipeline_b/landmark_extractor.py
─────────────────────────────────
Captures webcam frames, runs mediapipe.solutions.hands, and puts
the raw landmark list for the first detected hand onto an asyncio.Queue.

Standalone smoke-test:
    python pipeline_b/landmark_extractor.py
    → prints detected landmark count every second for 10 seconds, then exits.
"""
from __future__ import annotations

import asyncio
import time
from typing import List, Optional

import cv2
import mediapipe as mp

# ── mediapipe hand solution ───────────────────────────────────────────────
_mp_hands = mp.solutions.hands


class LandmarkExtractor:
    """
    Wraps mediapipe Hands in a loop that feeds an asyncio.Queue.

    Queue items: list[mediapipe.framework.formats.landmark_pb2.NormalizedLandmark]
    Each item is the 21-landmark list for the FIRST detected hand in the frame.
    If no hand is detected the frame is silently dropped.
    """

    def __init__(
        self,
        queue: asyncio.Queue,
        camera_index: int = 0,
        max_num_hands: int = 1,
        min_detection_confidence: float = 0.6,
        min_tracking_confidence: float = 0.5,
    ) -> None:
        self.queue = queue
        self.camera_index = camera_index
        self.max_num_hands = max_num_hands
        self.min_detection_confidence = min_detection_confidence
        self.min_tracking_confidence = min_tracking_confidence
        self._running = False

    async def run(self) -> None:
        """Async loop — run with asyncio.create_task() or asyncio.gather()."""
        self._running = True
        loop = asyncio.get_event_loop()

        cap = cv2.VideoCapture(self.camera_index)
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open camera index {self.camera_index}")

        with _mp_hands.Hands(
            max_num_hands=self.max_num_hands,
            min_detection_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        ) as hands:
            try:
                while self._running:
                    ret, frame = cap.read()
                    if not ret:
                        await asyncio.sleep(0.01)
                        continue

                    # mediapipe expects RGB
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = hands.process(rgb)

                    if results.multi_hand_landmarks:
                        # Take only the first hand
                        landmarks = list(results.multi_hand_landmarks[0].landmark)
                        # Non-blocking put — drop frame if consumer is slow
                        try:
                            self.queue.put_nowait(landmarks)
                        except asyncio.QueueFull:
                            pass  # consumer can't keep up; skip this frame

                    # Yield to event loop so other coroutines can run
                    await asyncio.sleep(0)
            finally:
                cap.release()

    def stop(self) -> None:
        self._running = False


# ── standalone smoke-test ─────────────────────────────────────────────────
if __name__ == "__main__":
    async def _smoke_test() -> None:
        print("Landmark extractor smoke-test — 10 seconds")
        print("Open your hand in front of the webcam.")
        print()
        q: asyncio.Queue = asyncio.Queue(maxsize=30)
        extractor = LandmarkExtractor(q)
        task = asyncio.create_task(extractor.run())

        start = time.perf_counter()
        last_print = start
        frame_count = 0

        while time.perf_counter() - start < 10:
            try:
                landmarks = q.get_nowait()
                frame_count += 1
            except asyncio.QueueEmpty:
                await asyncio.sleep(0.01)
                landmarks = None

            now = time.perf_counter()
            if now - last_print >= 1.0:
                if landmarks:
                    print(f"[{now - start:.1f}s] Detected hand — landmark count: {len(landmarks)}")
                else:
                    print(f"[{now - start:.1f}s] No hand detected")
                last_print = now

        extractor.stop()
        task.cancel()
        print(f"\nDone. Total frames with hand: {frame_count}")

    asyncio.run(_smoke_test())
