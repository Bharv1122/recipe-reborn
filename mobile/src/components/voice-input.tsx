import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { File } from 'expo-file-system';
import { Button, InlineError } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { colors } from '@/theme';

type Phase = 'idle' | 'starting' | 'recording' | 'transcribing' | 'canceling';
function removeClip(uri: string | null) {
  if (!uri) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Cache cleanup can be retried by the OS. */ }
}
function removeRecorderClip(recorder: { uri: string | null }) {
  try { removeClip(recorder.uri); } catch { /* The native recorder may already be released on unmount. */ }
}

export function VoiceInput({ label, disabled, onTranscript, onBusyChange }: {
  label: string; disabled?: boolean; onTranscript(text: string): void; onBusyChange(busy: boolean): void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const navigation = useNavigation();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const phaseRef = useRef<Phase>('idle');
  const active = useRef(true);
  const operation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Promise<void> | null>(null);
  const requestingPermission = useRef(false);

  const cancel = useCallback(async () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'canceling') return;
    operation.current++;
    phaseRef.current = 'canceling';
    if (active.current) { setPhase('canceling'); setNotice(''); }
    abortRef.current?.abort();
    if (timer.current) clearTimeout(timer.current);
    // Wait for preparation/transcription to settle before another clip can start.
    await pending.current?.catch(() => undefined);
    try { if (recorder.isRecording) await recorder.stop(); } catch { /* May already be stopped by the OS. */ }
    removeRecorderClip(recorder);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
    phaseRef.current = 'idle'; onBusyChange(false);
    if (active.current) setPhase('idle');
  }, [onBusyChange, recorder]);

  const cancelRef = useRef(cancel);
  useEffect(() => { cancelRef.current = cancel; }, [cancel]);
  useEffect(() => {
    const focus = () => { active.current = true; setPhase(phaseRef.current); };
    const blur = () => { active.current = false; void cancelRef.current(); };
    if (navigation.isFocused()) focus(); else blur();
    const unsubscribeFocus = navigation.addListener('focus', focus);
    const unsubscribeBlur = navigation.addListener('blur', blur);
    // Navigation objects can change while this screen is still focused. Replacing
    // a subscription must not cancel the recording the user just started.
    return () => { unsubscribeFocus(); unsubscribeBlur(); };
  }, [navigation]);
  useEffect(() => () => { active.current = false; void cancelRef.current(); }, []);
  useEffect(() => {
    // Android's permission activity can briefly background this app too. No audio
    // is recorded during that request; startup checks foreground state afterwards.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && !requestingPermission.current) void cancelRef.current();
    });
    return () => subscription.remove();
  }, []);

  const finish = () => {
    if (phaseRef.current !== 'recording') return;
    const current = operation.current;
    phaseRef.current = 'transcribing'; setPhase('transcribing');
    if (timer.current) clearTimeout(timer.current);
    const controller = new AbortController(); abortRef.current = controller;
    pending.current = (async () => {
    let uri: string | null = null;
    try {
      await recorder.stop(); uri = recorder.uri;
      if (!active.current || current !== operation.current) return;
      if (!uri) throw new Error('No recording was captured. Please try again.');
      const form = new FormData(); form.append('audio', new File(uri));
      const result = await apiRequest<{ text: string }>('/api/transcribe-audio', { method: 'POST', body: form, signal: controller.signal });
      if (!active.current || current !== operation.current) return;
      if (!result.text?.trim()) throw new Error('No speech was heard. Please try again or type your words.');
      onTranscript(result.text.trim()); setNotice('Your words are ready. Review them before continuing.');
    } catch (value) {
      if (active.current && current === operation.current) setError(value instanceof Error ? value.message : 'Voice could not be read. Please try again or type.');
    } finally {
      removeClip(uri);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (active.current && current === operation.current) { phaseRef.current = 'idle'; setPhase('idle'); onBusyChange(false); }
    }
    })();
    return pending.current;
  };

  const start = () => {
    if (disabled || phaseRef.current !== 'idle') return;
    const current = ++operation.current;
    phaseRef.current = 'starting'; setPhase('starting'); onBusyChange(true); setError(null); setNotice('');
    pending.current = (async () => {
    try {
      let permission = await AudioModule.getRecordingPermissionsAsync();
      if (!active.current || current !== operation.current) return;
      if (!permission.granted) {
        requestingPermission.current = true;
        try { permission = await AudioModule.requestRecordingPermissionsAsync(); }
        finally { requestingPermission.current = false; }
      }
      if (!active.current || current !== operation.current) return;
      if (!permission.granted) throw new Error('Microphone access is off. Enable it in your phone settings, or type instead.');
      if (AppState.currentState !== 'active') throw new Error('Return to Recipe Reborn and tap the voice button again to start recording.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!active.current || current !== operation.current) { await recorder.stop(); removeRecorderClip(recorder); return; }
      recorder.record(); phaseRef.current = 'recording'; setPhase('recording');
      timer.current = setTimeout(() => { void finish(); }, 60000);
    } catch (value) {
      removeRecorderClip(recorder);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      if (active.current && current === operation.current) {
        phaseRef.current = 'idle'; setPhase('idle'); onBusyChange(false);
        setError(value instanceof Error ? value.message : 'Could not start the microphone.');
      }
    }
    })();
    return pending.current;
  };

  return <View style={styles.container}>
    <Button label={phase === 'recording' ? 'Stop and use my words' : phase === 'transcribing' ? 'Reading your words…' : phase === 'canceling' ? 'Canceling…' : label} secondary loading={phase === 'starting' || phase === 'transcribing' || phase === 'canceling'} disabled={disabled && phase === 'idle'} onPress={phase === 'recording' ? finish : start} />
    {phase === 'recording' ? <Text accessibilityLiveRegion="polite" style={styles.note}>Listening. Speak naturally; recording stops after one minute.</Text> : null}
    {phase !== 'idle' && phase !== 'canceling' ? <Button label="Cancel voice input" secondary onPress={() => { void cancel(); }} /> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={styles.note}>{notice}</Text> : null}
    <InlineError message={error} />
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 6 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18 } });
