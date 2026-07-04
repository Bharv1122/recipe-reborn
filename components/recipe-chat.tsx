'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface RecipeChatRecipe {
  title: string;
  ingredients: string[];
  instructions: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  dietaryTags?: string[];
}

interface RecipeChatProps {
  recipe: RecipeChatRecipe;
}

const SUGGESTED_QUESTIONS = [
  'What can I prep ahead of time?',
  'How do I know when it’s done?',
  'What’s a good substitute if I’m missing an ingredient?',
];

// Context-aware Q&A about a single recipe. Streams answers from
// /api/recipe-chat, which pins the recipe into the system prompt.
export function RecipeChat({ recipe }: RecipeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]'
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || isProcessing) return;

    const userMessage: ChatMessage = { role: 'user', content: trimmed };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/recipe-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map((msg) => ({ role: msg.role, content: msg.content })),
          recipe,
        }),
      });

      if (!response?.ok) {
        throw new Error('Failed to get response from AI');
      }

      const reader = response?.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';
      let partialRead = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const result = await reader?.read();
        if (result?.done) break;

        partialRead += decoder.decode(result?.value, { stream: true });
        const lines = partialRead.split('\n');
        partialRead = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed?.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages((prev) => {
                const next = [...prev];
                if (next.length > 0) {
                  next[next.length - 1] = {
                    ...next[next.length - 1],
                    content: assistantMessage,
                  };
                }
                return next;
              });
            }
          } catch {
            // Skip invalid JSON chunks
          }
        }
      }
    } catch (error) {
      console.error('Recipe chat error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-[420px]">
      <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
        {messages.length === 0 ? (
          <div className="text-center py-8 space-y-4">
            <MessageCircle className="h-12 w-12 text-emerald-200 mx-auto" />
            <div>
              <h3 className="font-semibold text-gray-900">Ask about this recipe</h3>
              <p className="text-sm text-gray-600 mt-1">
                Substitutions, timing, techniques — your AI chef knows this recipe inside out.
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  onClick={() => sendMessage(question)}
                  className="text-sm px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full hover:bg-emerald-100 transition-colors"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pb-2">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {msg.content || (
                    <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this recipe..."
          disabled={isProcessing}
          className="bg-white"
        />
        <Button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white flex-shrink-0"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
