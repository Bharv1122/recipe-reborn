import { GoogleSignInButton } from 'react-native-nitro-google-signin';
export function GoogleLoginButton({ onPress, disabled }: { onPress(): void; disabled: boolean }) {
  return <GoogleSignInButton accessibilityLabel="Continue with Google" colorScheme="light" size="wide" signInBehavior="none" onPress={onPress} disabled={disabled} style={{ alignSelf: 'center', maxWidth: '100%' }} />;
}
