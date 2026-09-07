import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { clearChatHistory, loadChatHistory, saveChatHistory, type StoredChatMessage } from '@/services/chat-history';
import { useAuth } from '@/providers/auth-provider';
import { colors } from '@/theme';

type ChatMessage = StoredChatMessage;
const starterQuestions = [
  'What can I make with what I have?',
  'How can I replace an ingredient?',
  'Help me fix this dish',
];

export default function ChatScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const saveQueueRef = useRef(Promise.resolve());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    loadChatHistory(db, user.id)
      .then((history) => { if (active) setMessages(history); })
      .catch(() => { if (active) setError('Saved chat history could not be opened.'); })
      .finally(() => { if (active) setHistoryReady(true); });
    return () => { active = false; };
  }, [db, user?.id]);

  useEffect(() => {
    if (!historyReady || !user?.id) return;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveChatHistory(db, user.id, messages))
      .catch(() => setError('Chat history could not be saved.'));
  }, [db, historyReady, messages, user?.id]);

  const send = async (suggestion?: string) => {
    const content = (suggestion ?? draft).trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next); setDraft(''); setBusy(true); setError(null);
    try {
      const result = await apiRequest<{ message: ChatMessage }>('/api/mobile/chat', {
        method: 'POST', body: JSON.stringify({ messages: next.slice(-20) }),
      });
      setMessages([...next, result.message]);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'AI Chef could not answer right now.');
    } finally { setBusy(false); }
  };

  const confirmClear = () => {
    if (!user?.id || !messages.length) return;
    Alert.alert('Clear AI Chef history?', 'This removes the saved conversation from this phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        setMessages([]);
        saveQueueRef.current = saveQueueRef.current
          .catch(() => undefined)
          .then(() => clearChatHistory(db, user.id))
          .catch(() => setError('Chat history could not be cleared.'));
      } },
    ]);
  };

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'AI Chef', headerTintColor: colors.green }} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <View style={styles.composer}>
        <Field accessibilityLabel="Message AI Chef" placeholder="Ask a cooking question" value={draft} onChangeText={setDraft} multiline style={styles.input} />
        <View style={styles.sendButton}>
          <Button label="Send" onPress={send} loading={busy} disabled={!draft.trim()} />
        </View>
      </View>
      <InlineError message={error} />
      <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {!messages.length ? <Card>
          <Text style={styles.title}>Ask your AI Chef</Text>
          <Text style={styles.body}>Get cooking help, substitutions, techniques, and ideas that respect the allergies and dislikes saved in your account.</Text>
          <View style={styles.starters}>{starterQuestions.map((question) => <Pressable accessibilityRole="button" key={question} onPress={() => send(question)} style={styles.starter}><Text style={styles.starterText}>{question}</Text></Pressable>)}</View>
        </Card> : null}
        {messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.chefBubble]}>
          <Text style={styles.label}>{message.role === 'user' ? 'You' : 'AI Chef'}</Text>
          <Text style={styles.message}>{message.content}</Text>
        </View>)}
        {messages.length ? <Pressable accessibilityRole="button" accessibilityLabel="Clear AI Chef history" onPress={confirmClear} style={styles.clear}><Text style={styles.clearText}>Clear chat history</Text></Pressable> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, messages: { flex: 1 }, content: { gap: 10, paddingBottom: 14 },
  composer: { height: 58, flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  input: { flex: 1, minHeight: 50, maxHeight: 50 }, sendButton: { width: 92 },
  title: { color: colors.greenDark, fontSize: 22, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 21 },
  bubble: { maxWidth: '90%', borderRadius: 16, padding: 13, gap: 4 }, userBubble: { alignSelf: 'flex-end', backgroundColor: '#E8F5EC' },
  chefBubble: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  label: { color: colors.green, fontSize: 12, fontWeight: '800' }, message: { color: colors.ink, lineHeight: 21 },
  starters: { gap: 8 }, starter: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.green, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  starterText: { color: colors.green, fontWeight: '700' }, clear: { minHeight: 44, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 14 }, clearText: { color: colors.muted, fontWeight: '700' },
});
