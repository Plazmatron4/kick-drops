import { AudioPlayer, createAudioPlayer } from "expo-audio";
import { Platform } from "react-native";

let _player: AudioPlayer | null = null;
let _stopTimer: ReturnType<typeof setTimeout> | null = null;

export function isAlarmPlaying(): boolean {
  return _player !== null;
}

export async function playAlarm(ringtoneUri?: string | null): Promise<void> {
  if (Platform.OS === "web") return;
  await stopAlarm();

  try {
    const source = ringtoneUri
      ? { uri: ringtoneUri }
      : require("../assets/sounds/alarm.wav");

    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = 1.0;
    player.play();

    _player = player;

    _stopTimer = setTimeout(() => {
      stopAlarm();
    }, 30_000);
  } catch {
    _player = null;
  }
}

export async function stopAlarm(): Promise<void> {
  if (_stopTimer) {
    clearTimeout(_stopTimer);
    _stopTimer = null;
  }
  if (_player) {
    try {
      _player.pause();
      _player.remove();
    } catch {
      // Ignore cleanup errors
    }
    _player = null;
  }
}
