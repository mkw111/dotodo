import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const channel = "dotodo-reminders";
const source = "dotodo-task";

type Reminder = { taskId: string; title: string; at: number };

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function reminderPermission(request = false) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(channel, {
      name: "할 일 및 일정",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const status = request
    ? await Notifications.requestPermissionsAsync()
    : await Notifications.getPermissionsAsync();
  return status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ? "granted"
    : status.canAskAgain ? "requestable" : "blocked";
}

export function readReminders(value: unknown): Reminder[] | null {
  if (!Array.isArray(value) || value.length > 60) return null;
  return value.every((item) =>
    item && typeof item.taskId === "string" && item.taskId.length >= 1 &&
    item.taskId.length <= 100 && typeof item.title === "string" &&
    item.title.trim() && item.title.length <= 150 &&
    Number.isSafeInteger(item.at) && item.at > 0 && item.at < 8.64e15
  ) ? value : null;
}

export async function syncReminders(reminders: Reminder[], allowed: boolean) {
  const wanted = new Map(
    (allowed ? reminders : []).filter((item) => item.at > Date.now())
      .map((item) => [item.taskId, item])
  );
  for (const request of await Notifications.getAllScheduledNotificationsAsync()) {
    const data = request.content.data;
    if (data?.source !== source) continue;
    const item = wanted.get(String(data.taskId));
    if (item && item.at === data.at && item.title === request.content.body) {
      wanted.delete(item.taskId);
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
  for (const item of wanted.values()) {
    if (item.at <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "dotodo · 일정 알림",
        body: item.title,
        data: { source, taskId: item.taskId, at: item.at },
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.at,
        channelId: channel,
      },
    });
  }
}

export async function testReminder() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "dotodo · 테스트 알림",
      body: "앱 알림이 정상적으로 동작하고 있어요.",
      sound: "default",
      data: { source: "dotodo-test" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
      channelId: channel,
    },
  });
}

export function subscribeToReminderOpens(open: (id: string) => void) {
  let handled: string | undefined;
  function handle(response: Notifications.NotificationResponse | null) {
    const notification = response?.notification.request;
    if (!notification || response?.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
        notification.identifier === handled) return;
    const data = notification.content.data;
    if (data?.source !== source || typeof data.taskId !== "string") return;
    handled = notification.identifier;
    open(data.taskId);
    void Notifications.clearLastNotificationResponseAsync().catch(() => {});
  }
  const listener = Notifications.addNotificationResponseReceivedListener(handle);
  void Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
  return () => listener.remove();
}
