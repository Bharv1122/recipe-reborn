import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Field, InlineError } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { getSessionRevision } from '@/services/auth-storage';
import { submitContentReport, type ReportReason, type ReportTarget } from '@/services/content-reports';
import { colors } from '@/theme';

const reasons: { value: ReportReason; label: string }[] = [
  { value: 'unsafe', label: 'Unsafe advice' },
  { value: 'allergen', label: 'Allergy concern' },
  { value: 'offensive', label: 'Offensive content' },
  { value: 'incorrect', label: 'Incorrect information' },
  { value: 'other', label: 'Something else' },
];

export function ReportContentAction({ target }: { target: ReportTarget }) {
  const { user } = useAuth();
  const revision = getSessionRevision();
  if (!user?.id) return null;
  // A different account, session or selected response receives a fresh closed
  // dialog; notes and pending successes cannot carry into the next context.
  return <ReportContentDialog key={JSON.stringify([user.id, revision, target])} target={target} revision={revision} />;
}

function ReportContentDialog({ target, revision }: { target: ReportTarget; revision: number }) {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && revision === getSessionRevision();
  const isReply = target.source === 'chat';
  const label = isReply ? 'Report this reply' : 'Report recipe';
  const close = () => { if (!pending.current) setVisible(false); };
  const open = () => {
    if (!current() || pending.current) return;
    setReason(null); setDetails(''); setError(null); setSent(false); setVisible(true);
  };
  const submit = async () => {
    if (!current() || !visible || !reason || sent || pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      await submitContentReport(target, reason, details);
      if (current()) setSent(true);
    } catch (value) {
      if (current()) setError(value instanceof Error ? value.message : 'Your report could not be sent. Please try again.');
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={open} style={styles.action}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>{sent ? 'Report received' : label}</Text>
            {sent ? <>
              <Text accessibilityLiveRegion="polite" style={styles.body}>Thank you. Your report was saved for the Recipe Reborn team to review.</Text>
              <Button label="Done" onPress={close} />
            </> : <>
              <Text style={styles.body}>This sends {isReply ? 'only this AI Chef reply' : 'this recipe'}, your reason and optional note to Recipe Reborn for review.</Text>
              <Text style={styles.question}>What is the concern?</Text>
              {reasons.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityLabel={item.label}
                accessibilityState={{ checked: reason === item.value, disabled: busy }} disabled={busy}
                onPress={() => setReason(item.value)} style={[styles.reason, reason === item.value && styles.selected]}>
                <Text style={styles.reasonText}>{reason === item.value ? '●' : '○'}  {item.label}</Text>
              </Pressable>)}
              <Field accessibilityLabel="Optional report note" placeholder="Optional note (up to 500 characters)" value={details}
                onChangeText={setDetails} maxLength={500} multiline textAlignVertical="top" editable={!busy} style={styles.note} />
              <InlineError message={error} />
              <Button label="Send report" onPress={submit} loading={busy} disabled={!reason} />
              <Button label="Cancel" secondary disabled={busy} onPress={close} />
            </>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  action: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 4 },
  actionText: { color: colors.green, fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },
  overlay: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: 20 },
  dialog: { maxHeight: '90%', backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden' },
  content: { padding: 20, gap: 12 }, title: { color: colors.greenDark, fontSize: 22, fontWeight: '800' },
  body: { color: colors.ink, lineHeight: 21 }, question: { color: colors.ink, fontWeight: '700' },
  reason: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', paddingHorizontal: 12 },
  selected: { borderColor: colors.green, backgroundColor: '#E8F5EC' }, reasonText: { color: colors.ink, fontSize: 15 },
  note: { minHeight: 85, paddingTop: 12 },
});
