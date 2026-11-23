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

export interface AutoLedgerPermissions {
  notificationListener: boolean;
  accessibility: boolean;
  postNotifications: boolean;
}

export interface AutoLedgerSettings {
  notificationEnabled: boolean;
  accessibilityEnabled: boolean;
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

// In-memory preview queue used when previewing in Web / Expo Go without native APK
let previewFallbackCaptures: CapturedRecord[] = [];
const previewListeners = new Set<() => void>();

function notifyPreviewListeners(): void {
  previewListeners.forEach((cb) => cb());
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
      return { notificationEnabled: true, accessibilityEnabled: true };
    }
    try {
      return nativeModule.getSettings();
    } catch {
      return { notificationEnabled: true, accessibilityEnabled: true };
    }
  },

  updateSettings(settings: AutoLedgerSettings): void {
    nativeModule?.updateSettings(
      settings.notificationEnabled,
      settings.accessibilityEnabled
    );
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
