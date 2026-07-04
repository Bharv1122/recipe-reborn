'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  ArrowRight,
  ChefHat,
  Clock,
  ListChecks,
  Mic,
  MicOff,
  PartyPopper,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTextToSpeech } from '@/hooks/use-text-to-speech';
import { useVoiceCommands } from '@/hooks/use-voice-commands';

interface CookingModeRecipe {
  id: string;
  title: string;
  ingredients: string[];
  steps: string[];
  prepTime?: string;
  cookTime?: string;
  servings?: string;
}

interface CookingModeClientProps {
  recipe: CookingModeRecipe;
}

export function CookingModeClient({ recipe }: CookingModeClientProps) {
  const totalSteps = recipe.steps.length;
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const readAloudRef = useRef(readAloud);
  readAloudRef.current = readAloud;

  const { isSupported: ttsSupported, isSpeaking, speak, stop: stopSpeaking } =
    useTextToSpeech();

  const speakStep = useCallback(
    (stepIndex: number) => {
      const step = recipe.steps[stepIndex];
      if (!step) return;
      speak(`Step ${stepIndex + 1}. ${step}`);
    },
    [recipe.steps, speak]
  );

  const goToStep = useCallback(
    (stepIndex: number) => {
      const clamped = Math.max(0, Math.min(stepIndex, totalSteps - 1));
      setIsFinished(false);
      setCurrentStep(clamped);
      if (readAloudRef.current) speakStep(clamped);
    },
    [speakStep, totalSteps]
  );

  const handleNext = useCallback(() => {
    setCurrentStep((step) => {
      if (step >= totalSteps - 1) {
        setIsFinished(true);
        stopSpeaking();
        return step;
      }
      const next = step + 1;
      if (readAloudRef.current) speakStep(next);
      return next;
    });
  }, [speakStep, stopSpeaking, totalSteps]);

  const handleBack = useCallback(() => {
    setIsFinished(false);
    setCurrentStep((step) => {
      const prev = Math.max(0, step - 1);
      if (readAloudRef.current && prev !== step) speakStep(prev);
      return prev;
    });
  }, [speakStep]);

  const handleRepeat = useCallback(() => {
    setCurrentStep((step) => {
      speakStep(step);
      return step;
    });
  }, [speakStep]);

  const {
    isSupported: voiceSupported,
    isListening,
    lastCommand,
    error: voiceError,
    startListening,
    stopListening,
  } = useVoiceCommands({
    onNext: handleNext,
    onBack: handleBack,
    onRepeat: handleRepeat,
    onStop: () => {
      stopSpeaking();
      stopListening();
      toast('Voice control turned off', { icon: '🎙️' });
    },
  });

  useEffect(() => {
    if (voiceError) toast.error(voiceError);
  }, [voiceError]);

  const toggleVoiceControl = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      toast.success('Voice control on — say "next", "back", "repeat", or "stop"');
    }
  };

  const toggleReadAloud = () => {
    if (readAloud) {
      setReadAloud(false);
      stopSpeaking();
    } else {
      // Enabling counts as the user gesture browsers require before allowing
      // speech, so read the current step right away.
      setReadAloud(true);
      speakStep(currentStep);
    }
  };

  const progressValue = isFinished
    ? 100
    : totalSteps > 0
      ? ((currentStep + 1) / totalSteps) * 100
      : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 text-white min-w-0">
            <ChefHat className="h-6 w-6 flex-shrink-0 text-orange-300" />
            <h1 className="text-lg sm:text-xl font-bold truncate">{recipe.title}</h1>
          </div>
          <Link href="/recipes">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4 mr-1" />
              Exit
            </Button>
          </Link>
        </div>

        {/* Meta + progress */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-emerald-50/90 mb-2">
          {recipe.prepTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> Prep: {recipe.prepTime}
            </span>
          )}
          {recipe.cookTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> Cook: {recipe.cookTime}
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" /> Serves: {recipe.servings}
            </span>
          )}
        </div>
        <Progress value={progressValue} className="h-2 bg-white/20 mb-6" />

        {/* Voice + TTS controls */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {voiceSupported && (
            <Button
              onClick={toggleVoiceControl}
              size="sm"
              className={
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50'
              }
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop Voice Control
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Voice Control
                </>
              )}
            </Button>
          )}
          {ttsSupported && (
            <Button
              onClick={toggleReadAloud}
              size="sm"
              className={
                readAloud
                  ? 'bg-orange-400 hover:bg-orange-500 text-white'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50'
              }
            >
              {readAloud ? (
                <>
                  <VolumeX className="h-4 w-4 mr-2" />
                  Mute Steps
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 mr-2" />
                  Read Steps Aloud
                </>
              )}
            </Button>
          )}
          <Button
            onClick={() => setShowIngredients((v) => !v)}
            size="sm"
            variant="outline"
            className="bg-transparent border-white/40 text-white hover:bg-white/10 hover:text-white"
          >
            <ListChecks className="h-4 w-4 mr-2" />
            {showIngredients ? 'Hide Ingredients' : 'Ingredients'}
          </Button>
        </div>

        {/* Listening hint */}
        {isListening && (
          <div className="mb-4 text-sm text-emerald-50/90 bg-white/10 rounded-lg px-4 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1 font-medium text-white">
              <span className="animate-pulse text-red-300">●</span> Listening
            </span>
            <span>Say: &ldquo;next&rdquo; · &ldquo;back&rdquo; · &ldquo;repeat&rdquo; · &ldquo;stop&rdquo;</span>
            {lastCommand && (
              <span className="ml-auto px-2 py-0.5 bg-emerald-700/60 rounded-full text-xs">
                Heard: {lastCommand}
              </span>
            )}
          </div>
        )}

        {/* Ingredients reference */}
        {showIngredients && (
          <Card className="mb-6 bg-white shadow-lg">
            <CardContent className="pt-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Ingredients</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-emerald-600 mt-0.5">•</span>
                    <span>{ingredient}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Main step card */}
        <Card className="flex-1 bg-white shadow-2xl border-0 flex flex-col">
          <CardContent className="pt-8 pb-8 flex-1 flex flex-col justify-center">
            {totalSteps === 0 ? (
              <p className="text-center text-gray-600">
                This recipe has no instructions to cook through.
              </p>
            ) : isFinished ? (
              <div className="text-center space-y-6">
                <PartyPopper className="h-16 w-16 text-orange-400 mx-auto" />
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Bon appétit!</h2>
                  <p className="text-gray-600">
                    You finished all {totalSteps} steps of {recipe.title}.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button
                    onClick={() => goToStep(0)}
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Start Over
                  </Button>
                  <Link href="/recipes">
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                      Back to My Recipes
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-8">
                <div className="flex items-center justify-center gap-3">
                  <span className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">
                    Step {currentStep + 1} of {totalSteps}
                  </span>
                  {isSpeaking && (
                    <span className="flex items-center gap-1 text-sm text-orange-500">
                      <Volume2 className="h-4 w-4 animate-pulse" /> Reading…
                    </span>
                  )}
                </div>
                <p className="text-2xl sm:text-3xl leading-relaxed text-gray-900 font-medium px-2 sm:px-8">
                  {recipe.steps[currentStep]}
                </p>
                {ttsSupported && !readAloud && (
                  <Button
                    onClick={handleRepeat}
                    variant="ghost"
                    size="sm"
                    className="text-emerald-700 hover:bg-emerald-50"
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    Read this step
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        {totalSteps > 0 && !isFinished && (
          <div className="grid grid-cols-2 gap-4 mt-6">
            <Button
              onClick={handleBack}
              disabled={currentStep === 0}
              size="lg"
              variant="outline"
              className="h-16 text-lg bg-white/95 hover:bg-white text-gray-900 disabled:opacity-40"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              size="lg"
              className="h-16 text-lg bg-orange-400 hover:bg-orange-500 text-white"
            >
              {currentStep >= totalSteps - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
