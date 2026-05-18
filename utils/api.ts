import { Platform } from "react-native";

export interface Reward {
  id: string;
  name: string;
  image_url: string;
  required_units: number;
}

export interface Channel {
  id: number;
  slug: string;
  user: { id: number; username: string; profile_picture: string };
}

export interface Campaign {
  id: string;
  name: string;
  status: "active" | "expired" | "upcoming";
  starts_at: string;
  ends_at: string;
  category: { id: number; name: string; slug: string; image_url: string };
  organization: { name: string; logo_url: string; url: string };
  rewards: Reward[];
  channels: Channel[];
  connect_url: string;
}

const KICK_API = "https://web.kick.com/api/v1/drops/campaigns";
const PROXY_API = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api/drops`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export async function fetchCampaigns(): Promise<Campaign[]> {
  const url = Platform.OS === "web" ? PROXY_API : KICK_API;
  const headers: Record<string, string> =
    Platform.OS === "web" ? {} : { "User-Agent": USER_AGENT };

  const resp = await fetch(url, { headers });
  if (!resp.ok) throw new Error(`API returned ${resp.status}`);
  const data = await resp.json();
  return (data.data ?? []) as Campaign[];
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "N/A";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}
