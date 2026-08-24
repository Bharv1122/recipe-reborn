import { Text, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { colors } from '@/theme';

function TabIcon({ symbol, color }: { symbol: string; color: ColorValue }) {
  return <Text style={{ color, fontSize: 20 }}>{symbol}</Text>;
}

function HomeIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="🏠" color={color} />; }
function ScanIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="📷" color={color} />; }
function ShoppingIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="🛒" color={color} />; }
function AccountIcon({ color }: { color: ColorValue }) { return <TabIcon symbol="👤" color={color} />; }

export default function TabsLayout() {
  return <Tabs screenOptions={{
    headerStyle: { backgroundColor: colors.greenDark },
    headerTintColor: colors.white,
    tabBarActiveTintColor: colors.green,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { height: 64, paddingBottom: 8, paddingTop: 5 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'Recipe Reborn', tabBarIcon: HomeIcon }} />
    <Tabs.Screen name="scan" options={{ title: 'Scan', tabBarIcon: ScanIcon }} />
    <Tabs.Screen name="shopping" options={{ title: 'Shopping', tabBarIcon: ShoppingIcon }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: AccountIcon }} />
  </Tabs>;
}
