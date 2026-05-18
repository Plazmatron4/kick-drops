import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CampaignCard } from "@/components/CampaignCard";
import { useColors } from "@/hooks/useColors";
import { Campaign, fetchCampaigns } from "@/utils/api";
import { isAlarmPlaying, playAlarm, stopAlarm } from "@/utils/alarm";
import {
  checkAndNotify,
  registerBackgroundFetch,
  requestNotificationPermission,
} from "@/utils/notifications";
import {
  getRingtoneUri,
  setRingtoneUri,
} from "@/utils/storage";

const POLL_INTERVAL = 30_000;

export default function DropsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  // Alarm state
  const [alarmVisible, setAlarmVisible] = useState(false);
  const [alarmDrop, setAlarmDrop] = useState<{ name: string; game: string } | null>(null);
  const alarmPulse = useRef(new Animated.Value(1)).current;

  // Settings state
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [ringtoneUri, setRingtoneUriState] = useState<string | null>(null);
  const [ringtoneName, setRingtoneName] = useState<string>("Default alarm");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation for alarm
  useEffect(() => {
    if (!alarmVisible) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(alarmPulse, { toValue: 1.08, duration: 400, useNativeDriver: true }),
        Animated.timing(alarmPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [alarmVisible]);

  async function triggerAlarm(name: string, game: string) {
    setAlarmDrop({ name, game });
    setAlarmVisible(true);
    if (Platform.OS !== "web") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await playAlarm(ringtoneUri);
    }
    // Auto-dismiss overlay after 30s (alarm.ts also stops audio then)
    setTimeout(() => {
      setAlarmVisible(false);
    }, 30_000);
  }

  async function dismissAlarm() {
    setAlarmVisible(false);
    if (Platform.OS !== "web") {
      await stopAlarm();
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchCampaigns();
      const sorted = [...data].sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return 0;
      });
      setCampaigns(sorted);
      setActiveCount(sorted.filter((c) => c.status === "active").length);
      setLastChecked(new Date());
      // Pass already-fetched campaigns — no duplicate API call
      const newIds = await checkAndNotify(sorted);
      if (newIds.length > 0 && sorted.length > 0) {
        const newCamp = sorted.find(
          (c) => c.status === "active" && newIds.includes(c.id)
        );
        if (newCamp) {
          await triggerAlarm(newCamp.name, newCamp.category?.name ?? "Kick");
        }
      }
    } catch {
      setError("Failed to load campaigns. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ringtoneUri]);

  const onRefresh = useCallback(async () => {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setRefreshing(true);
    await load(true);
  }, [load]);

  // Listen for notification tap (app in background when drop fires)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (resp) => {
      const data = resp.notification.request.content.data as { type?: string };
      if (data?.type === "new_drop") {
        const body = resp.notification.request.content.body ?? "";
        const [name, game] = body.split(" • ");
        await triggerAlarm(name?.trim() ?? "New Drop", game?.trim() ?? "Kick");
      }
    });
    return () => sub.remove();
  }, [ringtoneUri]);

  useEffect(() => {
    (async () => {
      const uri = await getRingtoneUri();
      setRingtoneUriState(uri);
      if (uri) {
        const parts = uri.split("/");
        setRingtoneName(parts[parts.length - 1] ?? "Custom ringtone");
      }
      const granted = await requestNotificationPermission();
      setNotifGranted(granted);
      await registerBackgroundFetch();
      await load();
    })();

    pollRef.current = setInterval(() => {
      load(true);
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function pickRingtone() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        await setRingtoneUri(asset.uri);
        setRingtoneUriState(asset.uri);
        setRingtoneName(asset.name ?? "Custom ringtone");
      }
    } catch {}
  }

  async function resetRingtone() {
    await setRingtoneUri(null);
    setRingtoneUriState(null);
    setRingtoneName("Default alarm");
  }

  async function testRingtone() {
    if (Platform.OS === "web") return;
    if (isAlarmPlaying()) {
      await stopAlarm();
      return;
    }
    await playAlarm(ringtoneUri);
    setTimeout(() => stopAlarm(), 5_000);
  }

  function formatLastChecked() {
    if (!lastChecked) return "";
    const diff = Math.round((Date.now() - lastChecked.getTime()) / 1000);
    if (diff < 5) return "just now";
    if (diff < 60) return `${diff}s ago`;
    return `${Math.round(diff / 60)}m ago`;
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Kick Drops
          </Text>
          <View style={styles.headerSubRow}>
            {loading && !refreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      activeCount > 0
                        ? colors.primary
                        : colors.mutedForeground,
                  },
                ]}
              />
            )}
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {loading && !refreshing
                ? "Checking..."
                : activeCount > 0
                ? `${activeCount} active • updated ${formatLastChecked()}`
                : `No active drops • ${formatLastChecked()}`}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {notifGranted === false && (
            <Pressable
              onPress={async () => {
                const g = await requestNotificationPermission();
                setNotifGranted(g);
              }}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="bell-off"
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          )}
          {notifGranted === true && (
            <View style={[styles.iconButton]}>
              <Feather name="bell" size={16} color={colors.primary} />
            </View>
          )}
          <Pressable
            onPress={() => setSettingsVisible(true)}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.secondary,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="music" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {/* Campaign list */}
      {error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
            {error}
          </Text>
          <Pressable
            onPress={() => load()}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text
              style={[
                styles.retryText,
                { color: colors.primaryForeground },
              ]}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CampaignCard campaign={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: bottomPad + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!campaigns.length}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.center}>
                <Feather
                  name="inbox"
                  size={40}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.centerText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  No campaigns found
                </Text>
              </View>
            )
          }
        />
      )}

      {/* Alarm overlay */}
      <Modal
        visible={alarmVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.alarmOverlay}>
          <Animated.View
            style={[
              styles.alarmCard,
              { transform: [{ scale: alarmPulse }] },
            ]}
          >
            <View style={styles.alarmIconRow}>
              <Text style={styles.alarmEmoji}>🔥</Text>
            </View>
            <Text style={styles.alarmLabel}>NEW DROP LIVE</Text>
            <Text style={styles.alarmName} numberOfLines={2}>
              {alarmDrop?.name ?? ""}
            </Text>
            {alarmDrop?.game ? (
              <Text style={styles.alarmGame}>{alarmDrop.game}</Text>
            ) : null}
            <Pressable
              onPress={dismissAlarm}
              style={({ pressed }) => [
                styles.alarmStop,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="x-circle" size={20} color="#000000" />
              <Text style={styles.alarmStopText}>STOP</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      {/* Ringtone settings modal */}
      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <Pressable
          style={styles.settingsOverlay}
          onPress={() => setSettingsVisible(false)}
        >
          <Pressable
            style={[
              styles.settingsSheet,
              { backgroundColor: colors.card, paddingBottom: insets.bottom + 24 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.settingsHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.settingsTitle, { color: colors.foreground }]}>
              Ringtone
            </Text>
            <Text style={[styles.settingsCurrent, { color: colors.mutedForeground }]}>
              Current: {ringtoneName}
            </Text>

            <View style={styles.settingsBtns}>
              <Pressable
                onPress={pickRingtone}
                style={({ pressed }) => [
                  styles.settingsBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="folder" size={16} color={colors.foreground} />
                <Text style={[styles.settingsBtnText, { color: colors.foreground }]}>
                  Pick from device
                </Text>
              </Pressable>

              <Pressable
                onPress={testRingtone}
                style={({ pressed }) => [
                  styles.settingsBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Feather name="play" size={16} color={colors.primary} />
                <Text style={[styles.settingsBtnText, { color: colors.primary }]}>
                  Test (5 sec)
                </Text>
              </Pressable>

              {ringtoneUri && (
                <Pressable
                  onPress={resetRingtone}
                  style={({ pressed }) => [
                    styles.settingsBtn,
                    { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                  <Text style={[styles.settingsBtnText, { color: colors.destructive }]}>
                    Reset to default
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => setSettingsVisible(false)}
              style={({ pressed }) => [
                styles.settingsDone,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.settingsDoneText, { color: colors.primaryForeground }]}>
                Done
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 4,
  },
  headerSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", gap: 8 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
    marginTop: 80,
  },
  centerText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Alarm overlay
  alarmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  alarmCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    width: "100%",
    borderWidth: 2,
    borderColor: "#53FC18",
    shadowColor: "#53FC18",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  alarmIconRow: { marginBottom: 12 },
  alarmEmoji: { fontSize: 48 },
  alarmLabel: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#53FC18",
    letterSpacing: 2,
    marginBottom: 12,
  },
  alarmName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
    lineHeight: 28,
  },
  alarmGame: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#888888",
    marginBottom: 28,
  },
  alarmStop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#53FC18",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
  },
  alarmStopText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#000000",
    letterSpacing: 1.5,
  },

  // Settings sheet
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  settingsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  settingsHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 8,
  },
  settingsTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  settingsCurrent: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  settingsBtns: { gap: 10 },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  settingsBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  settingsDone: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  settingsDoneText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
