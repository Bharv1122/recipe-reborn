import { Redirect } from 'expo-router';
import { useAuth } from '@/providers/auth-provider';

export default function Index() {
  const { user } = useAuth();
  return <Redirect href={user ? '/(tabs)' : '/(auth)/sign-in'} />;
}
