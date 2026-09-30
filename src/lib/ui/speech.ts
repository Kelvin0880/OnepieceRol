// Reads AI-narrated bubbles aloud with the browser's own text-to-speech (no API, no cost). The browser's voice
// list loads asynchronously and varies wildly in quality, so `pickVoice` scores it towards whichever installed
// voice is least likely to sound robotic, instead of just taking voice #0.
"use client";

import { useSyncExternalStore } from "react";

let currentId: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Network/"neural"/"natural" voices are consistently less robotic than a platform's default local voice; a
// Spanish-tagged voice beats a generic one reading Spanish text with the wrong phonemes.
export function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const es = voices.filter((v) => v.lang?.toLowerCase().startsWith("es"));
  const pool = es.length > 0 ? es : voices;
  const scored = pool.map((v) => {
    const name = v.name.toLowerCase();
    let score = 0;
    if (!v.localService) score += 2;
    if (name.includes("neural") || name.includes("natural") || name.includes("online")) score += 3;
    if (name.includes("google")) score += 2;
    if (name.includes("multilingual")) score += 1;
    const lang = v.lang?.toLowerCase();
    if (lang === "es-es" || lang === "es-us" || lang === "es-mx" || lang === "es-419") score += 1;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.v;
}

function getVoicesAsync(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const onVoices = () => {
      synth.removeEventListener("voiceschanged", onVoices);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", onVoices);
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoices);
      resolve(synth.getVoices());
    }, 300);
  });
}

async function playUtterance(id: string, text: string): Promise<void> {
  const synth = window.speechSynthesis;
  const voices = await getVoicesAsync();
  if (currentId !== id) return; // stopped or superseded while voices were still loading
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(voices);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = "es-ES";
  }
  // A touch slower than default and unchanged pitch reads as calm/normal rather than a rushed announcer.
  utter.rate = 0.95;
  utter.pitch = 1;
  const clear = () => {
    if (currentId === id) {
      currentId = null;
      notify();
    }
  };
  utter.onend = clear;
  utter.onerror = clear;
  synth.speak(utter);
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
  if (currentId !== null) {
    currentId = null;
    notify();
  }
}

// Clicking the same message again stops it; clicking another one cuts the first off and starts the new one —
// speechSynthesis is a single shared voice, never two bubbles at once.
export function toggleSpeak(id: string, text: string): void {
  if (!isSpeechSupported()) return;
  const synth = window.speechSynthesis;
  const wasPlaying = currentId === id;
  synth.cancel();
  if (wasPlaying) {
    currentId = null;
    notify();
    return;
  }
  currentId = id;
  notify();
  void playUtterance(id, text);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): string | null {
  return currentId;
}

function getServerSnapshot(): string | null {
  return null;
}

export function useSpeakingId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
