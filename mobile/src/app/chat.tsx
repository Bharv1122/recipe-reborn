import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Button, Card, Field, InlineError, Screen } from '@/components/ui';
import { apiRequest } from '@/services/api';
import { colors } from '@/theme';

interface ChatMessage { role: 'user' | 'assistant'; content: string }

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const content = draft.trim();
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

  return <Screen>
    <Stack.Screen options={{ headerShown: true, title: 'AI Chef', headerTintColor: colors.green }} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!messages.length ? <Card>
          <Text style={styles.title}>Ask your AI Chef</Text>
          <Text style={styles.body}>Get cooking help, substitutions, techniques, and ideas that respect the allergies and dislikes saved in your account.</Text>
        </Card> : null}
        {messages.map((message, index) => <View key={`${message.role}-${index}`} style={[styles.bubble, message.role === 'user' ? styles.userBubble : styles.chefBubble]}>
          <Text style={styles.label}>{message.role === 'user' ? 'You' : 'AI Chef'}</Text>
          <Text style={styles.message}>{message.content}</Text>
        </View>)}
      </ScrollView>
      <InlineError message={error} />
      <View style={styles.composer}>
        <Field accessibilityLabel="Message AI Chef" placeholder="Ask a cooking question" value={draft} onChangeText={setDraft} multiline />
        <Button label="Send" onPress={send} loading={busy} disabled={!draft.trim()} />
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { gap: 10, paddingBottom: 14 }, composer: { gap: 8, paddingTop: 8 },
  title: { color: colors.greenDark, fontSize: 22, fontWeight: '800' }, body: { color: colors.muted, lineHeight: 21 },
  bubble: { maxWidth: '90%', borderRadius: 16, padding: 13, gap: 4 }, userBubble: { alignSelf: 'flex-end', backgroundColor: '#E8F5EC' },
  chefBubble: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  label: { color: colors.green, fontSize: 12, fontWeight: '800' }, message: { color: colors.ink, lineHeight: 21 },
});
