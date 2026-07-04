'use client';

import { Button } from '@/components/ui/button';
import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/use-text-to-speech';

interface VoiceReaderProps {
  // Built lazily so callers can assemble ingredients + instructions without
  // paying the string-join cost on every render.
  getText: () => string;
  label?: string;
  className?: string;
}

// Read-aloud controls backed by the browser's free speechSynthesis API.
// Renders nothing on browsers without TTS support.
export function VoiceReader({ getText, label = 'Listen', className }: VoiceReaderProps) {
  const { isSupported, isSpeaking, isPaused, speak, pause, resume, stop } =
    useTextToSpeech();

  if (!isSupported) return null;

  if (!isSpeaking) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => speak(getText())}
        className={`border-emerald-300 text-emerald-700 hover:bg-emerald-50 ${className ?? ''}`}
      >
        <Volume2 className="h-4 w-4 mr-2" />
        {label}
      </Button>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ''}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={isPaused ? resume : pause}
        className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      >
        {isPaused ? (
          <>
            <Play className="h-4 w-4 mr-2" />
            Resume
          </>
        ) : (
          <>
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={stop}
        className="border-red-200 text-red-600 hover:bg-red-50"
      >
        <Square className="h-4 w-4 mr-2" />
        Stop
      </Button>
    </div>
  );
}
