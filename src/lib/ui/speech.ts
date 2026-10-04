// Reads AI-narrated bubbles aloud. Primary voice (2026-10-04): a server-rendered edge-tts narration (see
// src/lib/tts/edge-tts.ts and /api/tts) — far more natural than any installed browser voice. edge-tts is
// Microsoft's own unofficial "Read aloud" service, not a stable API contract, so it can be throttled or
// changed without notice; every failure (network, timeout, blocked, decode) falls back transparently to the
// browser's own speechSynthesis below, which stays exactly as it was. `pickVoice` is that fallback's own voice
// scoring, towards whichever installed voice is least likely to sound robotic, instead of just taking voice #0.
"use client";

import { useSyncExternalStore } from "react";

let currentId: string | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let currentController: AbortController | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

// Audio-element playback (the edge-tts path) needs nothing special and works in every browser; speechSynthesis
// is only this module's fallback. Kept as a named export since ChatFeed uses it to decide whether to show the
// button at all — true everywhere a DOM exists.
export function isSpeechSupported(): boolean {
  return typeof window !== "undefined";
}

function hasSpeechSynthesis(): boolean {
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

async function playEdgeTts(id: string, text: string): Promise<void> {
  const controller = new AbortController();
  currentController = controller;
  const timeout = setTimeout(() => controller.abort(), 25000);
  let res: Response;
  try {
    res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`tts http ${res.status}`);
  const blob = await res.blob();
  if (currentId !== id) return; // toggled off, or superseded by another bubble, while the request was in flight
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  const release = () => {
    if (currentAudioUrl === url) {
      URL.revokeObjectURL(url);
      currentAudioUrl = null;
    }
    if (currentAudio === audio) currentAudio = null;
  };
  audio.onended = () => {
    release();
    if (currentId === id) {
      currentId = null;
      notify();
    }
  };
  audio.onerror = () => {
    release();
    if (currentId === id) {
      currentId = null;
      notify();
    }
  };
  currentAudio = audio;
  currentAudioUrl = url;
  try {
    await audio.play();
  } catch (err) {
    release();
    throw err; // caller falls back to speechSynthesis; currentId is left untouched so the fallback still claims it
  }
}

async function playNarration(id: string, text: string): Promise<void> {
  try {
    await playEdgeTts(id, text);
  } catch {
    if (currentId !== id) return; // already toggled off or superseded — don't speak stale text
    await playUtterance(id, text);
  }
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

function stopAll(): void {
  currentController?.abort();
  currentController = null;
  if (currentAudio) {
    currentAudio.onended = null;
    currentAudio.onerror = null;
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
  if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
}

export function stopSpeech(): void {
  stopAll();
  if (currentId !== null) {
    currentId = null;
    notify();
  }
}

// Clicking the same message again stops it; clicking another one cuts the first off and starts the new one —
// only ever one voice/clip playing at a time, same as before.
export function toggleSpeak(id: string, text: string): void {
  if (!isSpeechSupported()) return;
  const wasPlaying = currentId === id;
  stopAll();
  if (wasPlaying) {
    currentId = null;
    notify();
    return;
  }
  currentId = id;
  notify();
  void playNarration(id, text);
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
