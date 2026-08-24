import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest } from '@/services/api';
import { saveRegisteredPushToken } from '@/services/auth-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function enableLocalMealReminders() {
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Notifications are turned off for Recipe Reborn.');

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meal-reminders', {
      name: 'Meal reminders', importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return permission;
}

export async function scheduleMealReminder(title: string, date: Date) {
  await enableLocalMealReminders();
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Recipe Reborn', body: title, data: { kind: 'meal-reminder' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'meal-reminders' },
  });
}

export async function registerPushNotifications() {
  if (!Device.isDevice) throw new Error('Push registration requires a physical phone. Local reminders still work here.');
  const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Push registration will be enabled after the app is linked to its EAS project.');
  await enableLocalMealReminders();
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRequest('/api/mobile/push-tokens', {
    method: 'PUT',
    body: JSON.stringify({ token, platform: Platform.OS, deviceName: Device.deviceName || Device.modelName || undefined }),
  });
  await saveRegisteredPushToken(token);
  return token;
}
