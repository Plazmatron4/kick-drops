import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import {
  requestBatteryOptimizationExemption,
  requestNotificationPermission,
  setupAndroidChannel,
} from "@/utils/notifications";
import {
  startForegroundService,
} from "../../modules/KickDropsService/src/KickDropsService";

const POLL_INTERVAL = 15_000;

type FilterTab = "all" | "active" | "upcoming" | "expired";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "expired", label: "Expired" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FilterTab>("all");

  const { data, isLoading, isRefetching, refetch, error } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: fetchCampaigns,
    refetchInterval: POLL_INTERVAL,
    staleTime: 0,
  });

  useEffect(() => {
    (async () => {
      // Always prompt battery optimization on Android so the service survives
      await requestBatteryOptimizationExemption();

      const granted = await requestNotificationPermission();
      if (granted) {
        await setupAndroidChannel();
      }

      // Start the foreground service — it owns all background polling + notifications
      startForegroundService();
    })();
  }, []);

  const campaigns = data ?? [];
  const filtered =
    tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 12,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Kick Drops
          </Text>
          {activeCount > 0 && (
            <View style={[styles.livePill, { backgroundColor: "#53FC1820" }]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveCount}>{activeCount} LIVE</Text>
            </View>
          )}
        </View>

        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.tabBtn,
                  { backgroundColor: isActive ? colors.primary : colors.secondary },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color: isActive ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Fetching drops...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            Failed to load campaigns
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Retry
            </Text>
          </Pressable>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {tab === "all" ? "No drops found" : `No ${tab} drops`}
          </Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {tab === "active" ? "No live campaigns right now" : "Check back soon"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CampaignCard campaign={item} />}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 16) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#53FC18",
  },
  liveCount: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#53FC18",
    letterSpacing: 0.8,
  },
  tabRow: { flexDirection: "row", gap: 6 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  tabText: { fontSize: 13 },
  list: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 8 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
