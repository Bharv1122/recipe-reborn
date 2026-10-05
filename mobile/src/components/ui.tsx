import { useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '@/theme';

export function Screen({ children }: PropsWithChildren) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

export function Field(props: TextInputProps) {
  const [visible, setVisible] = useState(false);
  const input = useRef<TextInput>(null);
  if (!props.secureTextEntry) return <TextInput placeholderTextColor={colors.muted} {...props} style={[styles.field, props.style]} />;
  const label = props.accessibilityLabel || 'Password';
  return <View style={styles.passwordContainer}>
    <TextInput ref={input} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} {...props}
      secureTextEntry={!visible} style={[styles.field, props.style, styles.passwordField]} />
    <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
      accessibilityState={{ disabled: props.editable === false }} disabled={props.editable === false}
      onPress={() => { setVisible(value => !value); input.current?.focus(); }} style={styles.passwordToggle}>
      <Text style={styles.passwordToggleText}>{visible ? 'Hide' : 'Show'}</Text>
    </Pressable>
  </View>;
}

export function Button({ label, onPress, loading, secondary, disabled }: {
  label: string; onPress(): void; loading?: boolean; secondary?: boolean; disabled?: boolean;
}) {
  const unavailable = Boolean(disabled || loading);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(loading), disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed, unavailable && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={secondary ? colors.green : colors.white} /> :
        <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>}
    </Pressable>
  );
}

export function InlineError({ message }: { message: string | null }) {
  return message ? <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>{message}</Text> : null;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, padding: 20 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: colors.line, gap: 12 },
  passwordContainer: { position: 'relative' },
  passwordField: { paddingRight: 76 },
  passwordToggle: { position: 'absolute', right: 2, top: 2, bottom: 2, minWidth: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  passwordToggleText: { color: colors.green, fontWeight: '700' },
  field: { minHeight: 50, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 14, color: colors.ink, backgroundColor: colors.white },
  button: { minHeight: 50, borderRadius: 12, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.green },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  secondaryText: { color: colors.green },
  error: { color: colors.danger, fontSize: 14 },
});
