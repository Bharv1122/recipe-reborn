'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, Loader2, Send, Trash2, Volume2, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mode, setMode] = useState<'quick' | 'conversational'>('quick');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef?.current?.close();
      }
      if (mediaRecorderRef.current && mediaRecorderRef?.current?.state === 'recording') {
        mediaRecorderRef?.current?.stop();
      }
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

  const startRecording = async () => {
    try {
      const stream = await navigator?.mediaDevices?.getUserMedia({ audio: true });

      // Set up audio context for visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef?.current?.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef?.current?.createAnalyser();
      analyserRef.current.fftSize = 256;
      source?.connect(analyserRef.current);

      // Start audio level monitoring
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef?.current?.frequencyBinCount ?? 0);
        analyserRef?.current?.getByteFrequencyData(dataArray);
        const average = dataArray?.reduce((a, b) => a + b, 0) / (dataArray?.length ?? 1);
        setAudioLevel(average / 255); // Normalize to 0-1

        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      };
      updateAudioLevel();

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event?.data?.size > 0) {
          audioChunksRef?.current?.push(event.data);
        }
      });

      mediaRecorder.addEventListener('stop', async () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream?.getTracks()?.forEach((track) => track?.stop());
        await transcribeAudio(audioBlob);
      });

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      // Start recording duration timer
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      toast.success('Recording started - speak clearly!');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef?.current?.state === 'recording') {
      mediaRecorderRef?.current?.stop();
      setIsRecording(false);
      setAudioLevel(0);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response?.ok) {
        const errorData = await response?.json();
        throw new Error(errorData?.error ?? 'Failed to transcribe audio');
      }

      const data = await response.json();
      const transcribedText = data?.text ?? '';

      if (!transcribedText?.trim()) {
        toast.error('No speech detected. Please try again.');
        return;
      }

      // Add user message
      const userMessage: Message = {
        role: 'user',
        content: transcribedText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...(prev ?? []), userMessage]);

      // Process the message based on mode
      if (mode === 'quick') {
        // In quick mode, extract ingredients and call the callback
        onIngredientExtracted?.(transcribedText);
        toast.success('Ingredients extracted! Check the Generate tab.');
      } else {
        // In conversational mode, send to chat API
        await sendChatMessage([...messages, userMessage]);
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast.error(error?.message ?? 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const sendChatMessage = async (messageHistory: Message[]) => {
    setIsProcessing(true);

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
        if (result?.done) break;

        partialRead += decoder.decode(result?.value, { stream: true });
        let lines = partialRead?.split('\n') ?? [];
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
      console.error('Chat error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsProcessing(false);
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

  return (
    <div className="space-y-4">
      {/* Mode Selection */}
      <div className="flex gap-3">
        <Button
          variant={mode === 'quick' ? 'default' : 'outline'}
          onClick={() => setMode('quick')}
          className={mode === 'quick' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          disabled={isRecording || isTranscribing || isProcessing}
        >
          <Send className="mr-2 h-4 w-4" />
          Quick Mode
        </Button>
        <Button
          variant={mode === 'conversational' ? 'default' : 'outline'}
          onClick={() => setMode('conversational')}
          className={mode === 'conversational' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          disabled={isRecording || isTranscribing || isProcessing}
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

      {/* Chat History (only in conversational mode) */}
      {mode === 'conversational' && messages?.length > 0 && (
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">Conversation</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              disabled={isRecording || isTranscribing || isProcessing}
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
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing || isProcessing}
                className={`relative w-32 h-32 rounded-full ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                } text-white shadow-2xl transition-all duration-300 transform hover:scale-105`}
              >
                {isRecording ? (
                  <StopCircle className="h-12 w-12" />
                ) : isTranscribing || isProcessing ? (
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
                  <p className="text-sm text-gray-600">Tap the button to stop</p>
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
