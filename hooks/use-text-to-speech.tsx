'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Chrome silently stops long utterances after ~15 seconds, so text is split
// into sentence-sized chunks that are queued back-to-back. Pause/resume and
// stop operate on the whole queue, not just the current utterance.
const MAX_CHUNK_LENGTH = 200;

function splitIntoChunks(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, ' ')
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];

  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;

    if (current && current.length + trimmed.length + 1 > MAX_CHUNK_LENGTH) {
      chunks.push(current);
      current = trimmed;
    } else {
      current = current ? `${current} ${trimmed}` : trimmed;
    }

    // A single run-on sentence longer than the cap gets split on commas as a
    // last resort so Chrome never sees an oversized utterance.
    while (current.length > MAX_CHUNK_LENGTH) {
      const breakAt = current.lastIndexOf(',', MAX_CHUNK_LENGTH);
      const splitIndex = breakAt > 40 ? breakAt + 1 : MAX_CHUNK_LENGTH;
      chunks.push(current.slice(0, splitIndex).trim());
      current = current.slice(splitIndex).trim();
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export interface UseTextToSpeechOptions {
  rate?: number;
  onEnd?: () => void;
}

export function useTextToSpeech(options?: UseTextToSpeechOptions) {
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && 'speechSynthesis' in window
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const queueRef = useRef<string[]>([]);
  // Distinguishes our own cancel() from a natural end so onEnd only fires
  // when a read-through actually finished.
  const cancelingRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const stop = useCallback(() => {
    if (!isSupported) return;
    cancelingRef.current = true;
    queueRef.current = [];
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const speakNextChunk = useCallback(() => {
    const next = queueRef.current.shift();
    if (next === undefined) {
      setIsSpeaking(false);
      setIsPaused(false);
      optionsRef.current?.onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(next);
    utterance.lang = 'en-US';
    utterance.rate = optionsRef.current?.rate ?? 1;

    utterance.onend = () => {
      if (cancelingRef.current) return;
      speakNextChunk();
    };
    utterance.onerror = () => {
      if (cancelingRef.current) return;
      // Skip the failed chunk and keep reading rather than dying mid-recipe.
      speakNextChunk();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || !text?.trim()) return;

      cancelingRef.current = true;
      window.speechSynthesis.cancel();
      queueRef.current = splitIntoChunks(text);

      setIsSpeaking(true);
      setIsPaused(false);

      // Chrome can drop an utterance queued in the same tick as cancel();
      // yielding one tick makes back-to-back speak() calls reliable.
      window.setTimeout(() => {
        cancelingRef.current = false;
        speakNextChunk();
      }, 0);
    },
    [isSupported, speakNextChunk]
  );

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported]);

  // Stop any queued speech when the consuming component unmounts.
  useEffect(() => {
    if (!isSupported) return;
    return () => {
      cancelingRef.current = true;
      queueRef.current = [];
      window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  return { isSupported, isSpeaking, isPaused, speak, pause, resume, stop };
}
