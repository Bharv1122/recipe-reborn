'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, Loader2, Send, Trash2, Volume2, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  startVoiceRecording,
  transcribeRecording,
  type VoiceRecorderSession,
  type VoiceRecording,
} from '@/lib/browser-voice-recorder';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface VoiceChatProps {
  onIngredientExtracted?: (ingredients: string) => void;
}

export function VoiceChat({ onIngredientExtracted }: VoiceChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  // "Starting" covers the wait for the browser's microphone permission prompt.
  const [isStarting, setIsStarting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mode, setMode] = useState<'quick' | 'conversational'>('quick');
  // The most recent voice problem, kept on screen after the toast disappears.
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  // Voice input records the microphone in the browser (MediaRecorder) and
  // sends the clip to /api/transcribe-audio. The browser's built-in speech
  // recognition is not used here: it depends on an outside speech service
  // that fails in ways this page cannot recover from.
  const sessionRef = useRef<VoiceRecorderSession | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  // True from the moment a clip is handed off until its reply is finished.
  // A ref (not state) so a fast double tap cannot slip past it.
  const busyRef = useRef(false);
  const mountedRef = useRef(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Recorder callbacks run long after the render that created them, so they
  // read the latest values through refs instead of stale copies.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onIngredientExtractedRef = useRef(onIngredientExtracted);
  onIngredientExtractedRef.current = onIngredientExtracted;

  // Leaving the Voice tab: switch the microphone off, discard any recording
  // in progress (it is NOT uploaded) and cancel requests still in flight.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      sessionRef.current?.cancel();
      sessionRef.current = null;
      if (recordingTimerRef.current !== null) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      uploadAbortRef.current?.abort();
      chatAbortRef.current?.abort();
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef?.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer?.scrollHeight ?? 0;
      }
    }
  }, [messages]);

  const showVoiceError = (message: string) => {
    toast.error(message);
    setVoiceNotice(message);
  };

  const resetRecordingUi = () => {
    if (recordingTimerRef.current !== null) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsStarting(false);
    setIsRecording(false);
    setAudioLevel(0);
  };

  // Handles a final transcript: extract ingredients in Quick Mode, or send
  // it to the conversational chat API otherwise.
  const handleTranscript = async (transcribedText: string) => {
    if (!transcribedText?.trim()) {
      showVoiceError('No speech detected. Please try again.');
      return;
    }

    const userMessage: Message = {
      role: 'user',
      content: transcribedText,
      timestamp: new Date(),
    };
    setMessages((prev) => [...(prev ?? []), userMessage]);

    if (modeRef.current === 'quick') {
      onIngredientExtractedRef.current?.(transcribedText);
      toast.success('Ingredients extracted! Check the Generate tab.');
    } else {
      await sendChatMessage([...messagesRef.current, userMessage]);
    }
  };

  const transcribeAndHandle = async (recording: VoiceRecording) => {
    busyRef.current = true;
    setIsTranscribing(true);
    const controller = new AbortController();
    uploadAbortRef.current = controller;

    try {
      const transcribedText = await transcribeRecording(recording, { signal: controller.signal });
      if (!mountedRef.current) return;
      setIsTranscribing(false);
      await handleTranscript(transcribedText);
    } catch (error: any) {
      // Aborted because the user left the page: nothing to report.
      if (!mountedRef.current || error?.name === 'AbortError') return;
      console.error('Transcription error:', error?.message);
      showVoiceError(error?.message || 'Failed to transcribe audio. Please try again or type your ingredients.');
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) setIsTranscribing(false);
    }
  };

  const startRecording = () => {
    // Ignore extra taps while a recording or a reply is already under way.
    if (sessionRef.current || busyRef.current) return;

    setVoiceNotice(null);
    setIsStarting(true);

    // Every callback first checks that it belongs to the current recording,
    // so a cancelled or replaced session can never update the page late.
    const session = startVoiceRecording({
      onStart: () => {
        if (sessionRef.current !== session) return;
        setIsStarting(false);
        setIsRecording(true);
        setRecordingDuration(0);
        recordingTimerRef.current = window.setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
        toast.success('Recording started - speak clearly!');
      },
      onLevel: (level) => {
        if (sessionRef.current === session) setAudioLevel(level);
      },
      onComplete: (recording) => {
        if (sessionRef.current !== session) return;
        sessionRef.current = null;
        resetRecordingUi();
        if (recording.reason === 'max-duration') {
          toast('Recording stopped at the one-minute limit.');
        }
        void transcribeAndHandle(recording);
      },
      onError: (error) => {
        if (sessionRef.current !== session) return;
        sessionRef.current = null;
        resetRecordingUi();
        showVoiceError(error.message);
      },
    });
    sessionRef.current = session;
  };

  const stopRecording = () => {
    const session = sessionRef.current;
    if (!session) return;
    if (session.state === 'starting') {
      // Still waiting on the permission prompt: nothing recorded, so cancel.
      session.cancel();
      sessionRef.current = null;
      resetRecordingUi();
      return;
    }
    // Finishes the clip; onComplete above then sends it for transcription.
    session.stop();
  };

  const sendChatMessage = async (messageHistory: Message[]) => {
    setIsProcessing(true);
    const controller = new AbortController();
    chatAbortRef.current = controller;

    try {
      const apiMessages = messageHistory?.map?.((msg) => ({
        role: msg?.role,
        content: msg?.content,
      })) ?? [];

      const response = await fetch('/api/voice-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          mode: 'conversational',
        }),
        signal: controller.signal,
      });

      if (!response?.ok) {
        throw new Error('Failed to get response from AI');
      }

      // Stream the response
      const reader = response?.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let partialRead = '';

      // Add empty assistant message that we'll update
      const assistantMessageObj: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };
      setMessages((prev) => [...(prev ?? []), assistantMessageObj]);

      while (true) {
        const result = await reader?.read();
        if (!result || result.done) break;

        partialRead += decoder.decode(result?.value, { stream: true });
        const lines = partialRead?.split('\n') ?? [];
        partialRead = lines?.pop() ?? '';

        for (const line of lines) {
          if (line?.startsWith('data: ')) {
            const data = line?.slice(6);
            if (data === '[DONE]') {
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              const content = parsed?.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                // Update the last message
                setMessages((prev) => {
                  const newMessages = [...(prev ?? [])];
                  if (newMessages?.length > 0) {
                    newMessages[newMessages.length - 1] = {
                      ...newMessages[newMessages.length - 1],
                      content: assistantMessage,
                    };
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error) {
      // Aborted because the user left the page: nothing to report.
      if (controller.signal.aborted) return;
      console.error('Chat error:', error);
      toast.error('Failed to get AI response');
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      if (mountedRef.current) setIsProcessing(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat cleared');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs?.toString()?.padStart(2, '0')}`;
  };

  const isBusy = isStarting || isRecording || isTranscribing || isProcessing;

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="flex gap-3">
        <Button
          variant={mode === 'quick' ? 'default' : 'outline'}
          onClick={() => setMode('quick')}
          className={mode === 'quick' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          disabled={isBusy}
        >
          <Send className="mr-2 h-4 w-4" />
          Quick Mode
        </Button>
        <Button
          variant={mode === 'conversational' ? 'default' : 'outline'}
          onClick={() => setMode('conversational')}
          className={mode === 'conversational' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          disabled={isBusy}
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Conversational Mode
        </Button>
      </div>

      {/* Mode Description */}
      <Card className="bg-emerald-50 border-emerald-200">
        <CardContent className="pt-4">
          <p className="text-sm text-emerald-800">
            {mode === 'quick'
              ? '🎯 Quick Mode: Speak your ingredients, and we\'ll extract them directly to the Generate tab.'
              : '💬 Conversational Mode: Have a natural conversation with our AI chef about recipes, cooking tips, and ingredient suggestions.'}
          </p>
        </CardContent>
      </Card>

      {/* The last voice problem (microphone, recording or transcription),
          cleared when the next recording starts. */}
      {voiceNotice && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="pt-4">
            <p className="text-sm text-amber-800" role="alert">
              🎙️ {voiceNotice}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Chat History (only in conversational mode) */}
      {mode === 'conversational' && messages?.length > 0 && (
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Conversation</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={isBusy}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                <AnimatePresence>
                  {messages?.map?.((msg, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className={`flex ${msg?.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          msg?.role === 'user'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg?.content}</p>
                        <p
                          className={`text-xs mt-1 ${
                            msg?.role === 'user' ? 'text-emerald-100' : 'text-gray-500'
                          }`}
                        >
                          {msg?.timestamp?.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Recording Interface */}
      <Card className="shadow-lg border-2 border-emerald-200">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center space-y-6">
            {/* Visual Feedback */}
            <div className="relative">
              {/* Animated Circles */}
              {isRecording && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-500"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.1, 0.3],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    style={{
                      width: `${120 + audioLevel * 80}px`,
                      height: `${120 + audioLevel * 80}px`,
                      marginLeft: `${-(60 + audioLevel * 40)}px`,
                      marginTop: `${-(60 + audioLevel * 40)}px`,
                    }}
                  />
                  <motion.div
                    className="absolute inset-0 rounded-full bg-emerald-400"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.2, 0, 0.2],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: 0.5,
                    }}
                    style={{
                      width: `${140 + audioLevel * 100}px`,
                      height: `${140 + audioLevel * 100}px`,
                      marginLeft: `${-(70 + audioLevel * 50)}px`,
                      marginTop: `${-(70 + audioLevel * 50)}px`,
                    }}
                  />
                </>
              )}

              {/* Microphone Button */}
              <Button
                size="lg"
                onClick={isRecording || isStarting ? stopRecording : startRecording}
                disabled={isTranscribing || isProcessing}
                aria-label={isRecording ? 'Stop recording' : isStarting ? 'Cancel recording' : 'Start recording'}
                className={`relative w-32 h-32 rounded-full ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                } text-white shadow-2xl transition-all duration-300 transform hover:scale-105`}
              >
                {isRecording ? (
                  <StopCircle className="h-12 w-12" />
                ) : isStarting || isTranscribing || isProcessing ? (
                  <Loader2 className="h-12 w-12 animate-spin" />
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </Button>
            </div>

            {/* Status Text */}
            <div className="text-center">
              {isRecording ? (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-red-600 flex items-center justify-center gap-2">
                    <span className="animate-pulse">●</span>
                    Recording: {formatDuration(recordingDuration)}
                  </p>
                  <p className="text-sm text-gray-600">Tap the button to stop (1 minute max)</p>
                </div>
              ) : isStarting ? (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-emerald-600">Starting microphone...</p>
                  <p className="text-sm text-gray-600">
                    Choose Allow if your browser asks. Tap the button to cancel.
                  </p>
                </div>
              ) : isTranscribing ? (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-emerald-600">Transcribing audio...</p>
                  <p className="text-sm text-gray-600">Converting speech to text</p>
                </div>
              ) : isProcessing ? (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-emerald-600">Processing...</p>
                  <p className="text-sm text-gray-600">Getting AI response</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-lg font-semibold text-gray-700">Ready to listen</p>
                  <p className="text-sm text-gray-600">
                    Tap the microphone to start recording
                  </p>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="w-full bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">💡 Tips for best results:</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>• Speak clearly and at a normal pace</li>
                <li>• Minimize background noise</li>
                <li>• List ingredients one by one</li>
                <li>• Mention any dietary preferences or restrictions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
