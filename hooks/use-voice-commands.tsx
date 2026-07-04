'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceCommand = 'next' | 'back' | 'repeat' | 'stop';

export interface VoiceCommandHandlers {
  onNext?: () => void;
  onBack?: () => void;
  onRepeat?: () => void;
  onStop?: () => void;
}

// Spoken phrases → commands. Word-boundary matching keeps "backstage" from
// triggering "back", and synonyms cover how people naturally talk in a
// kitchen ("go on", "say that again", "previous step").
const COMMAND_PATTERNS: Array<{ command: VoiceCommand; pattern: RegExp }> = [
  { command: 'next', pattern: /\b(next|forward|continue|go on|proceed)\b/ },
  { command: 'back', pattern: /\b(back|previous|go back|last step)\b/ },
  { command: 'repeat', pattern: /\b(repeat|again|one more time)\b/ },
  { command: 'stop', pattern: /\b(stop|exit|quit|end|finish|done)\b/ },
];

function matchCommand(transcript: string): VoiceCommand | null {
  const text = transcript.toLowerCase();
  for (const { command, pattern } of COMMAND_PATTERNS) {
    if (pattern.test(text)) return command;
  }
  return null;
}

// The Web Speech API isn't in the standard DOM lib typings, and
// voice-chat.tsx already augments Window with its own local shape — so this
// hook reads the constructor via an `any` cast instead of a second (and
// conflicting) global declaration.
function getRecognitionCtor(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Continuous, hands-free command listener built on browser SpeechRecognition
// (Chrome/Edge/Safari). Chrome ends recognition sessions on its own every
// so often, so the hook auto-restarts until stopListening() is called.
export function useVoiceCommands(handlers: VoiceCommandHandlers) {
  const [isSupported] = useState(() => getRecognitionCtor() !== null);
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    setIsListening(false);
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || shouldListenRef.current) return;

    const dispatch = (command: VoiceCommand) => {
      setLastCommand(command);
      const h = handlersRef.current;
      if (command === 'next') h.onNext?.();
      else if (command === 'back') h.onBack?.();
      else if (command === 'repeat') h.onRepeat?.();
      else if (command === 'stop') h.onStop?.();
    };

    const createAndStart = () => {
      const recognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const results = event?.results;
        if (!results) return;
        for (let i = event.resultIndex ?? 0; i < results.length; i++) {
          const result = results[i];
          if (!result?.isFinal) continue;
          const transcript = result[0]?.transcript ?? '';
          const command = matchCommand(transcript);
          if (command) dispatch(command);
        }
      };

      recognition.onerror = (event: any) => {
        const errorType = event?.error;
        if (errorType === 'not-allowed' || errorType === 'service-not-allowed') {
          shouldListenRef.current = false;
          setIsListening(false);
          setError(
            'Microphone access was denied. Allow mic permissions to use voice commands.'
          );
        }
        // 'no-speech' / 'aborted' are routine in a quiet kitchen; onend's
        // auto-restart handles them.
      };

      recognition.onend = () => {
        if (shouldListenRef.current) {
          try {
            createAndStart();
          } catch {
            shouldListenRef.current = false;
            setIsListening(false);
          }
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    };

    setError(null);
    setLastCommand(null);
    shouldListenRef.current = true;

    try {
      createAndStart();
      setIsListening(true);
    } catch (e) {
      console.error('Failed to start voice commands:', e);
      shouldListenRef.current = false;
      setIsListening(false);
      setError('Could not start voice commands. Please try again.');
    }
  }, []);

  // Shut the microphone off if the consuming component unmounts mid-listen.
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop?.();
      recognitionRef.current = null;
    };
  }, []);

  return { isSupported, isListening, lastCommand, error, startListening, stopListening };
}
