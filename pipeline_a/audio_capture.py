#!/usr/bin/env python3
from __future__ import annotations

import io
import sys

# Ensure UTF-8 output on Windows (cp1252 can't encode arrows)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
"""
pipeline_a/audio_capture.py
────────────────────────────
Captures system audio via a sounddevice WASAPI loopback input stream and
writes raw PCM float32 chunks to an asyncio.Queue for downstream processing
(transcription, etc.).

WASAPI loopback lets you capture whatever is playing through the default
speaker/headphone output without a physical microphone — exactly what
Pipeline A needs for live subtitle generation.

Prerequisites (Windows only for WASAPI loopback):
    pip install sounddevice

Standalone smoke-test:
    python pipeline_a/audio_capture.py
    → prints queue size every second for 10 seconds, then exits.

Full pipeline entry point (Phase 5 — not yet wired):
    python -m pipeline_a.run
"""

import asyncio
import sys
import time
from typing import Optional

import numpy as np
import sounddevice as sd

# ── Config ────────────────────────────────────────────────────────────────────
TARGET_RATE    = 16_000   # Hz — what faster-whisper expects; we resample to this
CHANNELS       = 1        # mono
CHUNK_FRAMES   = 1_600    # ~100 ms per chunk at TARGET_RATE
QUEUE_MAXSIZE  = 50       # max queued chunks before oldest are dropped

# sounddevice hostapi / device selection
# Set to None to auto-select the default loopback device; override if needed.
LOOPBACK_DEVICE: Optional[str | int] = None


def _find_wasapi_loopback_device() -> int:
    """
    Return the device index of the first WASAPI loopback input device.

    Raises RuntimeError if no WASAPI loopback device is found (e.g. on Linux/macOS
    or if the Windows audio driver doesn't expose one).
    """
    wasapi_api_index: Optional[int] = None
    for i, api in enumerate(sd.query_hostapis()):
        if "WASAPI" in api["name"]:
            wasapi_api_index = i
            break

    if wasapi_api_index is None:
        raise RuntimeError(
            "No WASAPI host API found. "
            "WASAPI loopback is only available on Windows."
        )

    devices = sd.query_devices()
    for idx, dev in enumerate(devices):
        if (
            dev["hostapi"] == wasapi_api_index
            and dev["max_input_channels"] > 0
            and "loopback" in dev["name"].lower()
        ):
            return idx

    # Fallback: any WASAPI input device (some drivers don't label it "loopback")
    for idx, dev in enumerate(devices):
        if dev["hostapi"] == wasapi_api_index and dev["max_input_channels"] > 0:
            return idx

    raise RuntimeError(
        "No WASAPI input device found. "
        "Ensure a WASAPI-compatible audio driver is installed and "
        "your system audio is configured correctly."
    )


class AudioCapture:
    """
    Wraps a sounddevice.InputStream (WASAPI loopback) and feeds float32 PCM
    chunks into an asyncio.Queue.

    Usage::

        queue: asyncio.Queue[np.ndarray] = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        capture = AudioCapture(queue)
        await capture.run()          # blocks until stop() is called

    Queue items: 1-D float32 numpy arrays of length CHUNK_FRAMES (mono, 16 kHz).
    """

    def __init__(
        self,
        queue: asyncio.Queue,
        device: Optional[str | int] = LOOPBACK_DEVICE,
        target_rate: int = TARGET_RATE,
        channels: int = CHANNELS,
        chunk_frames: int = CHUNK_FRAMES,
    ) -> None:
        self.queue        = queue
        self.device       = device
        self.target_rate  = target_rate   # desired output rate (16 kHz)
        self.channels     = channels
        self.chunk_frames = chunk_frames  # in target-rate samples
        self._running     = False
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    # ── Public API ────────────────────────────────────────────────────────────

    async def run(self) -> None:
        """
        Open the WASAPI loopback stream and push PCM chunks to the queue
        until stop() is called.
        """
        self._running = True
        self._loop    = asyncio.get_event_loop()

        device_index = self.device
        if device_index is None:
            try:
                device_index = _find_wasapi_loopback_device()
                print(
                    f"[AudioCapture] Using WASAPI loopback device #{device_index}: "
                    f"{sd.query_devices(device_index)['name']}"
                )
            except RuntimeError as exc:
                print(f"[AudioCapture] WARNING — {exc}")
                print("[AudioCapture] Falling back to default input device.")
                device_index = sd.default.device[0]

        # Open at the device's native rate; resample down to target_rate ourselves.
        native_rate  = int(sd.query_devices(device_index)["default_samplerate"])
        decimate_by  = max(1, round(native_rate / self.target_rate))
        # blocksize in native-rate samples that yields chunk_frames after decimation
        native_block = self.chunk_frames * decimate_by

        print(
            f"[AudioCapture] Native rate: {native_rate} Hz  "
            f"-> decimate by {decimate_by} "
            f"-> output {self.target_rate} Hz"
        )

        def _sd_callback(
            indata: np.ndarray,
            frames: int,
            time_info,       # noqa: ANN001 — sounddevice CData object
            status: sd.CallbackFlags,
        ) -> None:
            """Called by sounddevice from a background thread for every chunk."""
            if status:
                print(f"[AudioCapture] sounddevice status: {status}", file=sys.stderr)

            # Flatten to mono, decimate to target_rate, hand to event loop
            mono: np.ndarray = indata[:, 0].astype(np.float32)
            chunk = mono[::decimate_by]   # simple decimation (no anti-alias filter)
            try:
                self._loop.call_soon_threadsafe(self.queue.put_nowait, chunk.copy())
            except asyncio.QueueFull:
                pass  # consumer lagging — silently drop

        with sd.InputStream(
            samplerate=native_rate,
            channels=self.channels,
            dtype="float32",
            blocksize=native_block,
            device=device_index,
            callback=_sd_callback,
        ):
            print(
                f"[AudioCapture] Stream open -- "
                f"{native_rate} Hz capture -> {self.target_rate} Hz output, "
                f"{self.channels}ch, {self.chunk_frames} frames/chunk. "
                f"Press Ctrl+C to stop."
            )
            while self._running:
                await asyncio.sleep(0.05)   # yield; callback fires on sd thread

    def stop(self) -> None:
        """Signal the run() coroutine to exit cleanly."""
        self._running = False


# ── Standalone smoke-test ─────────────────────────────────────────────────────
if __name__ == "__main__":
    async def _smoke_test() -> None:
        print("Audio capture smoke-test — 10 seconds")
        print("System audio will be captured via WASAPI loopback.")
        print("Play any audio on your machine to generate data.\n")

        q: asyncio.Queue[np.ndarray] = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
        capture = AudioCapture(q)
        task    = asyncio.create_task(capture.run())

        start = time.perf_counter()
        total_chunks = 0

        while time.perf_counter() - start < 10.0:
            await asyncio.sleep(1.0)
            # Drain everything currently in the queue and count it
            batch: list[np.ndarray] = []
            while True:
                try:
                    batch.append(q.get_nowait())
                except asyncio.QueueEmpty:
                    break
            total_chunks += len(batch)
            elapsed = time.perf_counter() - start
            queued  = q.qsize()
            print(
                f"[{elapsed:4.1f}s] "
                f"chunks this second: {len(batch):3d}  |  "
                f"total captured: {total_chunks:5d}  |  "
                f"queue size now: {queued:3d}"
            )

        capture.stop()
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

        duration_s  = total_chunks * CHUNK_FRAMES / TARGET_RATE
        print(
            f"\nDone. {total_chunks} chunks captured "
            f"({duration_s:.1f}s of audio at {TARGET_RATE} Hz)."
        )

    asyncio.run(_smoke_test())
