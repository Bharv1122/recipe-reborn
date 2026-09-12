import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 20 }}>{symbol}</Text>;
}

function HomeIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="🏠" color={color} />; }
function RecipesIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="📖" color={color} />; }
function ShoppingIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="🛒" color={color} />; }
function AccountIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="👤" color={color} />; }

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.greenDark },
    headerTintColor: colors.white,
    tabBarActiveTintColor: colors.green,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { height: 64 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 5 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'Recipe Reborn', tabBarIcon: HomeIcon }} />
    <Tabs.Screen name="library" options={{ title: 'Recipes', tabBarIcon: RecipesIcon }} />
    <Tabs.Screen name="scan" options={{ title: 'Scan a package', href: null }} />
    <Tabs.Screen name="shopping" options={{ title: 'Shopping', tabBarIcon: ShoppingIcon }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: AccountIcon }} />
  </Tabs>;
}
