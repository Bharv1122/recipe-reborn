import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { migrateShoppingCache } from '@/services/shopping-cache';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

function SessionRouter() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    const publicReset = segments[0] === 'forgot-password' || segments[0] === 'reset-password';
    if (!user && !inAuth && !publicReset) router.replace('/(auth)/sign-in');
    if (user && inAuth) router.replace('/(tabs)');
  }, [user, loading, segments, router]);

  if (loading) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
      <ActivityIndicator color={colors.green} size="large" />
      <Text style={{ color: colors.muted, marginTop: 12 }}>Opening Recipe Reborn…</Text>
    </View>;
  }
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }} />;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="recipe-reborn-mobile.db" onInit={migrateShoppingCache}>
      <AuthProvider><SessionRouter /></AuthProvider>
    </SQLiteProvider>
  );
}
