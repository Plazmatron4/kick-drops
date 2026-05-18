import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFIED_KEY = "@kick_drops_notified";
const RINGTONE_KEY = "@kick_drops_ringtone";

export async function getNotifiedIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export async function markNotified(ids: string[]): Promise<void> {
  try {
    const existing = await getNotifiedIds();
    ids.forEach((id) => existing.add(id));
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify([...existing]));
  } catch {}
}

export async function getRingtoneUri(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(RINGTONE_KEY);
  } catch {
    return null;
  }
}

export async function setRingtoneUri(uri: string | null): Promise<void> {
  try {
    if (uri) {
      await AsyncStorage.setItem(RINGTONE_KEY, uri);
    } else {
      await AsyncStorage.removeItem(RINGTONE_KEY);
    }
  } catch {}
}
