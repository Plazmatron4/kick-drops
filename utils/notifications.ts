import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";

export function setupNotificationHandler() {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
    }),
  });
}

export async function setupAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("drops-alarm", {
    name: "Drop Alerts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300, 200, 300],
    lightColor: "#53FC18",
    sound: "alarm.wav",
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableVibrate: true,
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Linking.sendIntent(
      "android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      [{ key: "android.provider.Settings.EXTRA_APP_PACKAGE", value: "com.wisdomwizzy.kickdrops" }]
    );
  } catch {
    Alert.alert(
      "Battery Optimization",
      'For drop alerts to work in the background, set Kick Drops to "Unrestricted" in Settings → Battery → App power management.',
      [
        { text: "Open Settings", onPress: () => Linking.openSettings() },
        { text: "Skip", style: "cancel" },
      ]
    );
  }
}
