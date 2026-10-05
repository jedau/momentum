"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  0: SpeechAlternative;
  isFinal: boolean;
}
interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}
interface SpeechEvent {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const subscribe = () => () => {};
const getSupportedSnapshot = () => getRecognitionCtor() !== null;
const getSupportedServerSnapshot = () => false;

/** Browser speech-to-text (Web Speech API). No API key, no cloud round-trip. */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const supported = useSyncExternalStore(
    subscribe,
    getSupportedSnapshot,
    getSupportedServerSnapshot
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const callbackRef = useRef(onTranscript);

  useEffect(() => {
    callbackRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      callbackRef.current(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        // already stopped
      }
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.start();
      setListening(true);
    } catch {
      // start() throws if already running
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, supported, start, stop };
}

export type SpeechEngine = "elevenlabs" | "browser" | "none";

/**
 * Text-to-speech that prefers a configured ElevenLabs voice and transparently
 * falls back to the browser voice so the feature always works.
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(async (text: string): Promise<SpeechEngine> => {
    if (!text.trim()) return "none";
    setSpeaking(true);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (response.ok && response.status !== 204) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          void audio.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        return "elevenlabs";
      }
    } catch {
      // fall through to browser voice
    } finally {
      setSpeaking(false);
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return "browser";
    }
    return "none";
  }, []);

  return { speak, speaking };
}
