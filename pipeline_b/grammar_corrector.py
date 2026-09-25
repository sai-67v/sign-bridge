import asyncio
import time
from typing import List

from pipeline_b.test_corrector import run_inference, BASE_MODEL, ADAPTER_REPO

class GrammarCorrector:
    """
    Consumes raw words from the CandidateSearch component, buffers them,
    and runs them through the Gemma grammar-correction adapter.
    Produces fluent sentences for the VirtualCamera.
    """
    def __init__(self, word_queue: asyncio.Queue, sentence_queue: asyncio.Queue, timeout: float = 1.5):
        self.word_queue = word_queue
        self.sentence_queue = sentence_queue
        self.timeout = timeout
        self._running = False
        self.buffer: List[str] = []
        self.model = None
        self.tokenizer = None
        self.last_word_time = time.time()

    async def run(self) -> None:
        self._running = True

        # Heavy imports inside run()
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from peft import PeftModel

        print("[GrammarCorrector] Loading base model and adapter via HF PEFT…")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

        self.tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
        base_model = AutoModelForCausalLM.from_pretrained(
            BASE_MODEL,
            quantization_config=bnb_config,
            device_map="auto",
            torch_dtype=torch.bfloat16
        )

        self.model = PeftModel.from_pretrained(base_model, ADAPTER_REPO)
        self.model.eval()
        print("[GrammarCorrector] Model loaded successfully.")

        while self._running:
            try:
                word = await asyncio.wait_for(self.word_queue.get(), timeout=0.1)
                self.buffer.append(word)
                self.last_word_time = time.time()
                print(f"[GrammarCorrector] Buffered word: '{word}'")
            except asyncio.TimeoutError:
                if self.buffer and (time.time() - self.last_word_time > self.timeout):
                    await self._process_buffer()

    async def _process_buffer(self) -> None:
        words = list(self.buffer)
        self.buffer.clear()
        
        user_text = " ".join(words)
        print(f"[GrammarCorrector] Translating buffer: '{user_text}'")
        
        # Offload blocking inference to a thread
        reply = await asyncio.to_thread(run_inference, self.model, self.tokenizer, user_text)
        sentence = reply.strip()
        
        print(f"[GrammarCorrector] -> '{sentence}'")
        try:
            self.sentence_queue.put_nowait(sentence)
        except asyncio.QueueFull:
            pass

    def stop(self) -> None:
        self._running = False
