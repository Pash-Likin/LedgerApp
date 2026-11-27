import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { autoLedger } from './autoLedger';

let cachedHapticsEnabled: boolean | null = null;
const hapticsListeners = new Set<(enabled: boolean) => void>();

export function isHapticsEnabled(): boolean {
  if (cachedHapticsEnabled === null) {
    cachedHapticsEnabled = autoLedger.getHapticsEnabled();
  }
  return cachedHapticsEnabled;
}

export function setHapticsEnabled(enabled: boolean): void {
  cachedHapticsEnabled = enabled;
  autoLedger.setHapticsEnabled(enabled);
  hapticsListeners.forEach((cb) => cb(enabled));
}

export function subscribeHapticsChanged(
  listener: (enabled: boolean) => void
): () => void {
  hapticsListeners.add(listener);
  return () => {
    hapticsListeners.delete(listener);
  };
}

export function triggerLightHaptic(): void {
  if (Platform.OS === 'web' || !isHapticsEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function triggerSelectionHaptic(): void {
  if (Platform.OS === 'web' || !isHapticsEnabled()) return;
  Haptics.selectionAsync().catch(() => {});
}

export function triggerSuccessHaptic(): void {
  if (Platform.OS === 'web' || !isHapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
