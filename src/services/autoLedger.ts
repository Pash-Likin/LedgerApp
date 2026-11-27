import {
  NativeModule,
  requireOptionalNativeModule,
  type EventSubscription,
} from 'expo';
import { Platform } from 'react-native';
import type { TransactionType } from '../types/ledger';
import { formatLocalDateTime } from '../utils/date';
import { parsePaymentNotificationText } from '../utils/paymentParser';

export type CaptureChannel = 'notification' | 'accessibility' | 'demo';
export type CaptureStatus = 'pending' | 'confirmed';

export interface CapturedRecord {
  id: string;
  type: TransactionType;
  amountCents: number;
  merchant: string;
  suggestedCategoryId: string;
  suggestedCategoryName: string;
  sourceApp: string;
  channel: CaptureChannel;
  occurredAt: string;
  rawSummary: string;
  status: CaptureStatus;
  notificationId: number;
  createdAtMs: number;
}

export interface CaptureLogEntry {
  timestamp: string;
  sourceApp: string;
  channel: CaptureChannel;
  snippet: string;
  outcome: string;
  matched: boolean;
}

export interface AutoLedgerPermissions {
  notificationListener: boolean;
  accessibility: boolean;
  postNotifications: boolean;
}

export interface AutoLedgerSettings {
  notificationEnabled: boolean;
  accessibilityEnabled: boolean;
  hapticsEnabled?: boolean;
}

export interface LaunchAction {
  action: 'review_capture' | 'quick_add';
  captureId?: string;
}

export interface WidgetSnapshotInput {
  monthLabel: string;
  totalExpenseCents: number;
  totalIncomeCents: number;
  netCents: number;
  latestSummary: string;
}

type AutoLedgerNativeEvents = {
  onCapturesChanged: (event: { timestamp: number }) => void;
  onLaunchAction: (event: { action: string; captureId?: string }) => void;
};

declare class AutoLedgerNativeModule extends NativeModule<AutoLedgerNativeEvents> {
  getPermissionStatus(): AutoLedgerPermissions;
  requestPostNotificationsPermission(): boolean;
  openNotificationListenerSettings(): void;
  openAccessibilitySettings(): void;
  openAppNotificationSettings(): void;
  openBatteryOptimizationSettings(): void;
  getSettings(): AutoLedgerSettings;
  updateSettings(notificationEnabled: boolean, accessibilityEnabled: boolean): void;
  getHapticsEnabled(): boolean;
  setHapticsEnabled(enabled: boolean): void;
  getCaptureLogs(): string;
  clearCaptureLogs(): void;
  getCaptures(): string;
  removeCapture(id: string): void;
  clearConfirmedCaptures(idsJson: string): void;
  consumeLaunchAction(): string | null;
  updateWidgetData(
    monthLabel: string,
    totalExpenseCents: number,
    totalIncomeCents: number,
    netCents: number,
    latestSummary: string
  ): void;
  requestPinWidget(): boolean;
  simulateCaptureNotification(sourceApp: string, sampleText: string): boolean;
}

const nativeModule =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<AutoLedgerNativeModule>('AutoLedger')
    : null;

const WEB_HAPTICS_KEY = 'qingjizhang_haptics_enabled';
const WEB_AUTO_CAPTURE_KEY = 'qingjizhang_auto_capture_settings';
let previewFallbackCaptures: CapturedRecord[] = [];
let previewFallbackLogs: CaptureLogEntry[] = [];
let fallbackHapticsEnabled = true;
let fallbackCaptureSettings: {
  notificationEnabled: boolean;
  accessibilityEnabled: boolean;
} = {
  notificationEnabled: false,
  accessibilityEnabled: false,
};
const previewListeners = new Set<() => void>();
const settingsListeners = new Set<(settings: AutoLedgerSettings) => void>();

function notifyPreviewListeners(): void {
  previewListeners.forEach((cb) => cb());
}

function notifySettingsListeners(settings: AutoLedgerSettings): void {
  settingsListeners.forEach((cb) => cb(settings));
}

function readWebCaptureSettings(): {
  notificationEnabled: boolean;
  accessibilityEnabled: boolean;
} {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(WEB_AUTO_CAPTURE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<{
          notificationEnabled: boolean;
          accessibilityEnabled: boolean;
        }>;
        return {
          notificationEnabled: Boolean(parsed.notificationEnabled),
          accessibilityEnabled: Boolean(parsed.accessibilityEnabled),
        };
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return { ...fallbackCaptureSettings };
}

function writeWebCaptureSettings(
  notificationEnabled: boolean,
  accessibilityEnabled: boolean
): void {
  fallbackCaptureSettings = { notificationEnabled, accessibilityEnabled };
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        WEB_AUTO_CAPTURE_KEY,
        JSON.stringify(fallbackCaptureSettings)
      );
    }
  } catch {
    // Ignore storage access errors
  }
}

function readWebHaptics(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const val = window.localStorage.getItem(WEB_HAPTICS_KEY);
      if (val === 'false') return false;
      if (val === 'true') return true;
    }
  } catch {
    // Ignore storage access errors
  }
  return fallbackHapticsEnabled;
}

function writeWebHaptics(enabled: boolean): void {
  fallbackHapticsEnabled = enabled;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(WEB_HAPTICS_KEY, enabled ? 'true' : 'false');
    }
  } catch {
    // Ignore storage access errors
  }
}

export const autoLedger = {
  isNativeAvailable(): boolean {
    return Platform.OS === 'android' && nativeModule !== null;
  },

  getPermissionStatus(): AutoLedgerPermissions {
    if (!nativeModule) {
      return {
        notificationListener: false,
        accessibility: false,
        postNotifications: false,
      };
    }
    try {
      return nativeModule.getPermissionStatus();
    } catch {
      return {
        notificationListener: false,
        accessibility: false,
        postNotifications: false,
      };
    }
  },

  requestPostNotificationsPermission(): boolean {
    if (!nativeModule) return false;
    try {
      return nativeModule.requestPostNotificationsPermission();
    } catch {
      return false;
    }
  },

  openNotificationListenerSettings(): void {
    nativeModule?.openNotificationListenerSettings();
  },

  openAccessibilitySettings(): void {
    nativeModule?.openAccessibilitySettings();
  },

  openAppNotificationSettings(): void {
    nativeModule?.openAppNotificationSettings();
  },

  openBatteryOptimizationSettings(): void {
    nativeModule?.openBatteryOptimizationSettings();
  },

  getSettings(): AutoLedgerSettings {
    if (!nativeModule) {
      const saved = readWebCaptureSettings();
      return {
        notificationEnabled: saved.notificationEnabled,
        accessibilityEnabled: saved.accessibilityEnabled,
        hapticsEnabled: readWebHaptics(),
      };
    }
    try {
      return nativeModule.getSettings();
    } catch {
      return {
        notificationEnabled: false,
        accessibilityEnabled: false,
        hapticsEnabled: true,
      };
    }
  },

  updateSettings(settings: AutoLedgerSettings): void {
    writeWebCaptureSettings(
      settings.notificationEnabled,
      settings.accessibilityEnabled
    );
    nativeModule?.updateSettings(
      settings.notificationEnabled,
      settings.accessibilityEnabled
    );
    notifySettingsListeners({
      ...settings,
      hapticsEnabled: settings.hapticsEnabled ?? this.getHapticsEnabled(),
    });
  },

  subscribeSettingsChanged(
    listener: (settings: AutoLedgerSettings) => void
  ): () => void {
    settingsListeners.add(listener);
    return () => {
      settingsListeners.delete(listener);
    };
  },

  getHapticsEnabled(): boolean {
    if (!nativeModule) {
      return readWebHaptics();
    }
    try {
      return nativeModule.getHapticsEnabled();
    } catch {
      return true;
    }
  },

  setHapticsEnabled(enabled: boolean): void {
    writeWebHaptics(enabled);
    if (!nativeModule) return;
    try {
      nativeModule.setHapticsEnabled(enabled);
    } catch {
      // Ignore native bridge error
    }
  },

  getCaptureLogs(): CaptureLogEntry[] {
    if (!nativeModule) {
      return [...previewFallbackLogs];
    }
    try {
      const raw = nativeModule.getCaptureLogs();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CaptureLogEntry[]) : [];
    } catch {
      return [];
    }
  },

  clearCaptureLogs(): void {
    previewFallbackLogs = [];
    if (!nativeModule) return;
    try {
      nativeModule.clearCaptureLogs();
    } catch {
      // Ignore
    }
  },

  getCaptures(): CapturedRecord[] {
    if (!nativeModule) {
      return [...previewFallbackCaptures];
    }
    try {
      const raw = nativeModule.getCaptures();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CapturedRecord[]) : [];
    } catch {
      return [];
    }
  },

  removeCapture(id: string): void {
    if (!nativeModule) {
      previewFallbackCaptures = previewFallbackCaptures.filter((c) => c.id !== id);
      notifyPreviewListeners();
      return;
    }
    nativeModule.removeCapture(id);
  },

  clearConfirmedCaptures(ids: string[]): void {
    if (ids.length === 0) return;
    if (!nativeModule) {
      const set = new Set(ids);
      previewFallbackCaptures = previewFallbackCaptures.filter((c) => !set.has(c.id));
      notifyPreviewListeners();
      return;
    }
    nativeModule.clearConfirmedCaptures(JSON.stringify(ids));
  },

  consumeLaunchAction(): LaunchAction | null {
    if (!nativeModule) return null;
    try {
      const raw = nativeModule.consumeLaunchAction();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { action?: string; captureId?: string };
      if (parsed.action === 'review_capture' || parsed.action === 'quick_add') {
        return {
          action: parsed.action,
          captureId: parsed.captureId || undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  updateWidgetData(snapshot: WidgetSnapshotInput): void {
    if (!nativeModule) return;
    try {
      nativeModule.updateWidgetData(
        snapshot.monthLabel,
        snapshot.totalExpenseCents,
        snapshot.totalIncomeCents,
        snapshot.netCents,
        snapshot.latestSummary
      );
    } catch {
      // Ignore widget update failures
    }
  },

  requestPinWidget(): boolean {
    if (!nativeModule) return false;
    try {
      return nativeModule.requestPinWidget();
    } catch {
      return false;
    }
  },

  simulateCaptureNotification(sourceApp: string, sampleText: string): boolean {
    if (nativeModule) {
      try {
        return nativeModule.simulateCaptureNotification(sourceApp, sampleText);
      } catch {
        return false;
      }
    }

    const parsed = parsePaymentNotificationText({
      sourceApp,
      title: sourceApp,
      content: sampleText,
    });
    if (!parsed) return false;
    const nowMs = Date.now();
    const record: CapturedRecord = {
      id: `cap_preview_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
      type: parsed.type,
      amountCents: parsed.amountCents,
      merchant: parsed.merchant,
      suggestedCategoryId: parsed.suggestedCategoryId,
      suggestedCategoryName: parsed.suggestedCategoryName,
      sourceApp: parsed.sourceApp,
      channel: 'demo',
      occurredAt: formatLocalDateTime(new Date(nowMs)),
      rawSummary: parsed.rawSummary,
      status: 'pending',
      notificationId: 2001,
      createdAtMs: nowMs,
    };
    previewFallbackCaptures = [record, ...previewFallbackCaptures];
    previewFallbackLogs = [
      {
        timestamp: formatLocalDateTime(new Date(nowMs)).slice(5).replace('T', ' '),
        sourceApp,
        channel: 'demo',
        snippet: sampleText,
        outcome: `模拟识别 ¥${(parsed.amountCents / 100).toFixed(2)} → ${parsed.suggestedCategoryName}`,
        matched: true,
      },
      ...previewFallbackLogs.slice(0, 24),
    ];
    notifyPreviewListeners();
    return true;
  },

  subscribeCapturesChanged(listener: () => void): () => void {
    if (!nativeModule) {
      previewListeners.add(listener);
      return () => {
        previewListeners.delete(listener);
      };
    }
    const sub: EventSubscription = nativeModule.addListener(
      'onCapturesChanged',
      () => listener()
    );
    return () => sub.remove();
  },

  subscribeLaunchAction(
    listener: (payload: LaunchAction) => void
  ): () => void {
    if (!nativeModule) {
      return () => {};
    }
    const sub: EventSubscription = nativeModule.addListener(
      'onLaunchAction',
      (event) => {
        if (event.action === 'review_capture' || event.action === 'quick_add') {
          listener({
            action: event.action,
            captureId: event.captureId || undefined,
          });
        }
      }
    );
    return () => sub.remove();
  },
};
