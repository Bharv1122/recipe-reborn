import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

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

// Push delivery is deliberately not registered until an EAS project and a
// bearer-protected token-registration endpoint exist. Local reminders work now.
