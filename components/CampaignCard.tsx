import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";
import React from "react";
import {
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import { Campaign, formatTime } from "@/utils/api";

interface Props {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: Props) {
  const colors = useColors();

  const isActive = campaign.status === "active";
  const rewardCount = campaign.rewards?.length ?? 0;
  const channelCount = campaign.channels?.length ?? 0;

  async function handleOpen() {
    if (Platform.OS !== "web") {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const url = campaign.connect_url || "https://kick.com/drops/all-campaigns";
    if (Platform.OS === "web") {
      Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.categoryRow}>
          {campaign.category?.image_url ? (
            <Image
              source={{ uri: campaign.category.image_url }}
              style={styles.categoryImage}
            />
          ) : (
            <View style={[styles.categoryPlaceholder, { backgroundColor: colors.secondary }]}>
              <Feather name="award" size={16} color={colors.primary} />
            </View>
          )}
          <Text style={[styles.categoryText, { color: colors.mutedForeground }]}>
            {campaign.category?.name ?? "General"}
          </Text>
        </View>

        <View style={[
          styles.statusBadge,
          { backgroundColor: isActive ? "#53FC1820" : colors.secondary }
        ]}>
          <View style={[
            styles.statusDot,
            { backgroundColor: isActive ? "#53FC18" : colors.mutedForeground }
          ]} />
          <Text style={[
            styles.statusText,
            { color: isActive ? "#53FC18" : colors.mutedForeground }
          ]}>
            {isActive ? "LIVE" : campaign.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
        {campaign.name}
      </Text>

      {campaign.organization?.name ? (
        <Text style={[styles.org, { color: colors.mutedForeground }]}>
          {campaign.organization.name}
        </Text>
      ) : null}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <View style={styles.timeRow}>
        <Feather name="clock" size={13} color={colors.mutedForeground} />
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
          {formatTime(campaign.starts_at)} → {formatTime(campaign.ends_at)}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          {rewardCount > 0 && (
            <View style={styles.metaBadge}>
              <Feather name="gift" size={12} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.primary }]}>
                {rewardCount} reward{rewardCount !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
          {channelCount > 0 && (
            <View style={styles.metaBadge}>
              <Feather name="tv" size={12} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                {channelCount} ch
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={handleOpen}
          style={({ pressed }) => [
            styles.openButton,
            { backgroundColor: isActive ? colors.primary : colors.secondary },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={[
            styles.openText,
            { color: isActive ? colors.primaryForeground : colors.mutedForeground }
          ]}>
            Open
          </Text>
          <Feather
            name="external-link"
            size={12}
            color={isActive ? colors.primaryForeground : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  categoryImage: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  categoryPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  name: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
    lineHeight: 22,
  },
  org: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 12,
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    flex: 1,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  openText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
