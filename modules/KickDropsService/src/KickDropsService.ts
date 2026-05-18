import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

const NativeModule = requireOptionalNativeModule("KickDropsService");

export function startForegroundService(): void {
  if (Platform.OS !== "android") return;
  NativeModule?.startService();
}

export function stopForegroundService(): void {
  if (Platform.OS !== "android") return;
  NativeModule?.stopService();
}
