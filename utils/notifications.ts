import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { Campaign, fetchCampaigns } from "./api";
import { getNotifiedIds, markNotified } from "./storage";

export const BACKGROUND_FETCH_TASK = "kick-drops-bg-fetch";

export function setupNotificationHandler() {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
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

export async function sendDropNotification(
  name: string,
  game: string
): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔥 New Kick Drop!",
      body: `${name} • ${game} — tap to open`,
      sound: "alarm.wav",
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { type: "new_drop" },
    },
    trigger: null,
  });
}

// Accepts pre-fetched campaigns to avoid a duplicate API call
export async function checkAndNotify(
  prefetchedCampaigns?: Campaign[]
): Promise<string[]> {
  try {
    const campaigns = prefetchedCampaigns ?? (await fetchCampaigns());
    const notifiedIds = await getNotifiedIds();
    const newIds: string[] = [];

    for (const camp of campaigns) {
      if (camp.status === "active" && !notifiedIds.has(camp.id)) {
        await sendDropNotification(camp.name, camp.category?.name ?? "Kick");
        newIds.push(camp.id);
      }
    }

    if (newIds.length > 0) {
      await markNotified(newIds);
    }

    return newIds;
  } catch {
    return [];
  }
}

if (Platform.OS !== "web") {
  TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
    try {
      const newIds = await checkAndNotify();
      return newIds.length > 0
        ? BackgroundFetch.BackgroundFetchResult.NewData
        : BackgroundFetch.BackgroundFetchResult.NoData;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

export async function registerBackgroundFetch(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await setupAndroidChannel();
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      return;
    }
    await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
      minimumInterval: 60 * 15,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    // Already registered — ignore
  }
}
