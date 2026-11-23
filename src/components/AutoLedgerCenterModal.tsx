import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW, SPACING, TABULAR_NUMS } from '../constants/theme';
import { useLedger } from '../context/LedgerContext';
import {
  autoLedger,
  type AutoLedgerPermissions,
  type AutoLedgerSettings,
  type CapturedRecord,
} from '../services/autoLedger';
import { showAlert } from '../services/dialog';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../services/haptics';
import { computeMonthlySummary } from '../utils/analytics';
import { formatYearMonthLabel } from '../utils/date';
import { formatYuan } from '../utils/money';

interface AutoLedgerCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onReviewCapture: (capture: CapturedRecord) => void;
}

export function AutoLedgerCenterModal({
  visible,
  onClose,
  onReviewCapture,
}: AutoLedgerCenterModalProps) {
  const insets = useSafeAreaInsets();
  const {
    pendingCaptures,
    syncAutoCaptures,
    ignorePendingCapture,
    syncWidgetSnapshot,
    transactions,
    selectedMonth,
  } = useLedger();

  const [permissions, setPermissions] = useState<AutoLedgerPermissions>(() =>
    autoLedger.getPermissionStatus()
  );
  const [settings, setSettings] = useState<AutoLedgerSettings>(() =>
    autoLedger.getSettings()
  );

  const isNative = autoLedger.isNativeAvailable();
  const widgetSummary = useMemo(
    () => computeMonthlySummary(selectedMonth, transactions),
    [selectedMonth, transactions]
  );

  const refreshNativeStatus = useCallback(() => {
    setPermissions(autoLedger.getPermissionStatus());
    setSettings(autoLedger.getSettings());
    syncAutoCaptures().catch(() => {});
  }, [syncAutoCaptures]);

  useEffect(() => {
    if (!visible) return;
    refreshNativeStatus();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshNativeStatus();
      }
    });
    return () => sub.remove();
  }, [visible, refreshNativeStatus]);

  const handleToggleSetting = (
    key: 'notificationEnabled' | 'accessibilityEnabled',
    value: boolean
  ) => {
    triggerSelectionHaptic();
    const next = { ...settings, [key]: value };
    setSettings(next);
    autoLedger.updateSettings(next);
  };

  const handleRequestPostPermission = () => {
    const alreadyGranted = autoLedger.requestPostNotificationsPermission();
    if (!alreadyGranted) {
      setTimeout(() => refreshNativeStatus(), 900);
    } else {
      refreshNativeStatus();
      showAlert('已开启', '发送通知权限已开启，识别到付款后会第一时间弹出记账确认通知。');
    }
  };

  const handleSimulate = (sourceApp: string, sampleText: string) => {
    const ok = autoLedger.simulateCaptureNotification(sourceApp, sampleText);
    if (!ok) {
      showAlert('模拟失败', '示例文本未匹配到有效金额。');
      return;
    }
    triggerSuccessHaptic();
    syncAutoCaptures().catch(() => {});
    if (isNative) {
      if (!permissions.postNotifications) {
        showAlert(
          '已生成待确认记录，但未弹出横幅通知',
          '请在上方开启「发送通知权限」，开启后手机通知栏就会弹出确认通知。'
        );
      } else {
        showAlert(
          '已发送模拟支付通知',
          '请下拉手机通知栏查看弹出的确认通知，可直接点「记为「餐饮」」或「选分类」。'
        );
      }
    } else {
      showAlert(
        '已生成模拟捕获记录',
        '当前处于浏览器/Expo Go 预览模式，可在下方「待确认列表」点击该记录体验确认分类弹窗；打包为安卓 APK 后会直接在系统通知栏弹窗。'
      );
    }
  };

  const handlePinWidget = async () => {
    await syncWidgetSnapshot();
    if (!isNative) {
      showAlert(
        '需要安装安卓 APK',
        '桌面小组件属于安卓原生功能，打包安装最新 APK 后，可在此一键添加到手机桌面，或在桌面长按空白处添加「轻记账 · 月度概览」。'
      );
      return;
    }
    const pinned = autoLedger.requestPinWidget();
    if (pinned) {
      triggerSuccessHaptic();
      showAlert('请在系统弹窗确认', '请在手机弹出的窗口中点击「添加 / 允许」，小组件就会出现在桌面。');
    } else {
      showAlert(
        '请通过桌面手势添加',
        '当前手机桌面限制直接弹窗添加，请按以下方式手动添加：\n1. 返回手机桌面，双指捏合或长按空白处\n2. 选择「添加工具 / 小组件 / 插件」\n3. 找到「轻记账 · 月度概览」拖放到桌面即可。'
      );
    }
  };

  const handleSyncWidget = async () => {
    await syncWidgetSnapshot();
    triggerSuccessHaptic();
    showAlert('已同步', '桌面小组件已更新为本月最新收支数据。');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, SPACING.lg) },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>自动记账与桌面小组件</Text>
              <Text style={styles.subtitle}>
                识别微信、支付宝、美团支付后弹出通知确认记账
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
          >
            {!isNative ? (
              <View style={styles.noticeCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={COLORS.warning}
                />
                <Text style={styles.noticeText}>
                  当前未检测到安卓原生模块（可能处于浏览器或 Expo Go 预览）。重新运行 EAS 云端打包并安装最新 APK 后，通知监听、无障碍识别与桌面小组件即可全部生效。
                </Text>
              </View>
            ) : null}

            {/* 1. Permissions & Auto-capture Controls */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>一、安卓实时自动记账权限</Text>
              <Text style={styles.sectionDesc}>
                开启「通知使用权」或「无障碍服务」后，在微信、支付宝、美团支付完成时会自动识别金额与商户，并弹出通知询问你是否记账及类型。
              </Text>

              <PermissionRow
                icon="notifications-outline"
                title="1. 弹出确认通知权限（必开）"
                desc="用于在手机顶部弹出「是否记账 / 选分类」提示通知"
                granted={permissions.postNotifications}
                buttonText={permissions.postNotifications ? '已开启' : '去开启'}
                onPress={handleRequestPostPermission}
              />

              <PermissionRow
                icon="shield-checkmark-outline"
                title="2. 通知栏使用权（推荐）"
                desc="监听微信支付、支付宝、美团扣款/收款推送通知"
                granted={permissions.notificationListener}
                buttonText={permissions.notificationListener ? '已授权' : '去授权'}
                onPress={() => autoLedger.openNotificationListenerSettings()}
              />

              <PermissionRow
                icon="accessibility-outline"
                title="3. 无障碍服务（补充兜底）"
                desc="当微信/美团关闭通知推送时，在“支付成功”界面自动识别"
                granted={permissions.accessibility}
                buttonText={permissions.accessibility ? '已开启' : '去开启'}
                onPress={() => autoLedger.openAccessibilitySettings()}
              />

              <PermissionRow
                icon="battery-charging-outline"
                title="4. 后台运行省电设置（可选）"
                desc="防止国产手机系统在锁屏后杀死监听服务"
                granted={null}
                buttonText="去设置"
                onPress={() => autoLedger.openBatteryOptimizationSettings()}
                isLast
              />

              <View style={styles.switchBlock}>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>启用通知栏监听识别</Text>
                  <Switch
                    value={settings.notificationEnabled}
                    onValueChange={(v) =>
                      handleToggleSetting('notificationEnabled', v)
                    }
                    trackColor={{ false: COLORS.border, true: COLORS.primaryTint }}
                    thumbColor={
                      settings.notificationEnabled
                        ? COLORS.primary
                        : COLORS.textMuted
                    }
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>启用支付成功页无障碍识别</Text>
                  <Switch
                    value={settings.accessibilityEnabled}
                    onValueChange={(v) =>
                      handleToggleSetting('accessibilityEnabled', v)
                    }
                    trackColor={{ false: COLORS.border, true: COLORS.primaryTint }}
                    thumbColor={
                      settings.accessibilityEnabled
                        ? COLORS.primary
                        : COLORS.textMuted
                    }
                  />
                </View>
              </View>

              <View style={styles.simSection}>
                <Text style={styles.simTitle}>测试通知弹窗效果</Text>
                <View style={styles.simBtns}>
                  <TouchableOpacity
                    onPress={() =>
                      handleSimulate(
                        '美团外卖',
                        '订单支付成功，在美团外卖消费实付¥36.50'
                      )
                    }
                    style={styles.simBtn}
                  >
                    <Text style={styles.simBtnText}>模拟美团外卖 ¥36.50</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      handleSimulate(
                        '微信',
                        '微信支付：你已向瑞幸咖啡付款18.80元'
                      )
                    }
                    style={styles.simBtn}
                  >
                    <Text style={styles.simBtnText}>模拟微信咖啡 ¥18.80</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 2. Pending Captures */}
            <View style={styles.sectionCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>
                  二、待确认自动记账（{pendingCaptures.length}）
                </Text>
                <TouchableOpacity onPress={refreshNativeStatus} hitSlop={8}>
                  <Text style={styles.linkText}>刷新</Text>
                </TouchableOpacity>
              </View>

              {pendingCaptures.length === 0 ? (
                <Text style={styles.emptyPending}>
                  暂无待处理记录。收到支付通知或点击上方模拟按钮后会显示在这里。
                </Text>
              ) : (
                <View style={styles.pendingList}>
                  {pendingCaptures.map((item) => (
                    <View key={item.id} style={styles.pendingRow}>
                      <TouchableOpacity
                        style={styles.pendingMain}
                        onPress={() => onReviewCapture(item)}
                      >
                        <Text style={styles.pendingTitle}>
                          {item.merchant} ·{' '}
                          <Text
                            style={{
                              color:
                                item.type === 'expense'
                                  ? COLORS.expense
                                  : COLORS.income,
                            }}
                          >
                            {item.type === 'expense' ? '-' : '+'}¥
                            {formatYuan(item.amountCents)}
                          </Text>
                        </Text>
                        <Text style={styles.pendingMeta}>
                          来源：{item.sourceApp} · 推荐「{item.suggestedCategoryName}」· 点击选择分类
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => ignorePendingCapture(item.id)}
                        style={styles.pendingIgnore}
                        hitSlop={8}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color={COLORS.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 3. Home Screen Widget */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>三、手机桌面小组件</Text>
              <Text style={styles.sectionDesc}>
                在安卓桌面展示本月支出、收入、结余与最新一条账单，并支持直接点小组件右上角「+ 记一笔」秒开记账。
              </Text>

              {/* Mini Widget Preview */}
              <View style={styles.widgetPreview}>
                <View style={styles.widgetHeader}>
                  <View style={styles.widgetTitleLeft}>
                    <Text style={styles.widgetAppName}>轻记账</Text>
                    <Text style={styles.widgetMonth}>
                      {formatYearMonthLabel(selectedMonth)}
                    </Text>
                  </View>
                  <View style={styles.widgetAddPill}>
                    <Text style={styles.widgetAddText}>+ 记一笔</Text>
                  </View>
                </View>

                <View style={styles.widgetKpis}>
                  <View style={styles.widgetKpiBox}>
                    <Text style={styles.widgetKpiLabel}>本月支出</Text>
                    <Text style={[styles.widgetKpiVal, { color: COLORS.expense }]}>
                      ¥{formatYuan(widgetSummary.totalExpenseCents)}
                    </Text>
                  </View>
                  <View style={styles.widgetKpiBox}>
                    <Text style={styles.widgetKpiLabel}>本月收入</Text>
                    <Text style={[styles.widgetKpiVal, { color: COLORS.income }]}>
                      ¥{formatYuan(widgetSummary.totalIncomeCents)}
                    </Text>
                  </View>
                  <View style={styles.widgetKpiBox}>
                    <Text style={styles.widgetKpiLabel}>本月结余</Text>
                    <Text style={[styles.widgetKpiVal, { color: COLORS.primary }]}>
                      ¥{formatYuan(widgetSummary.netCents)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.widgetActions}>
                <TouchableOpacity
                  onPress={handlePinWidget}
                  style={styles.pinWidgetBtn}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name="apps-outline"
                    size={18}
                    color={COLORS.white}
                  />
                  <Text style={styles.pinWidgetText}>一键添加到手机桌面</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSyncWidget}
                  style={styles.syncWidgetBtn}
                >
                  <Text style={styles.syncWidgetText}>同步数据</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PermissionRow({
  icon,
  title,
  desc,
  granted,
  buttonText,
  onPress,
  isLast = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  granted: boolean | null;
  buttonText: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.permRow, !isLast && styles.permRowBorder]}>
      <View
        style={[
          styles.permIconBox,
          granted === true
            ? { backgroundColor: COLORS.incomeSoft }
            : { backgroundColor: COLORS.bg },
        ]}
      >
        <Ionicons
          name={icon}
          size={19}
          color={granted === true ? COLORS.income : COLORS.textSecondary}
        />
      </View>
      <View style={styles.permBody}>
        <Text style={styles.permTitle}>{title}</Text>
        <Text style={styles.permDesc}>{desc}</Text>
      </View>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.permBtn,
          granted === true ? styles.permBtnDone : styles.permBtnPending,
        ]}
      >
        <Text
          style={[
            styles.permBtnText,
            granted === true ? styles.permBtnTextDone : styles.permBtnTextPending,
          ]}
        >
          {buttonText}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '92%',
    paddingTop: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    gap: SPACING.md,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.warningSoft,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    ...SHADOW.card,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: SPACING.md,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 10,
  },
  permRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  permIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permBody: {
    flex: 1,
  },
  permTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  permDesc: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  permBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  permBtnPending: {
    backgroundColor: COLORS.primary,
  },
  permBtnDone: {
    backgroundColor: COLORS.incomeSoft,
  },
  permBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  permBtnTextPending: {
    color: COLORS.white,
  },
  permBtnTextDone: {
    color: COLORS.income,
  },
  switchBlock: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    gap: 6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  simSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  simTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  simBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  simBtn: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryTint,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  linkText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  emptyPending: {
    fontSize: 12.5,
    color: COLORS.textMuted,
    paddingVertical: SPACING.sm,
  },
  pendingList: {
    gap: 8,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
  },
  pendingMain: {
    flex: 1,
  },
  pendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    fontVariant: [...TABULAR_NUMS],
  },
  pendingMeta: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pendingIgnore: {
    padding: 4,
  },
  widgetPreview: {
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  widgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  widgetTitleLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  widgetAppName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  widgetMonth: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
  },
  widgetAddPill: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  widgetAddText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  widgetKpis: {
    flexDirection: 'row',
    gap: 6,
  },
  widgetKpiBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  widgetKpiLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  widgetKpiVal: {
    fontSize: 12.5,
    fontWeight: '800',
    marginTop: 2,
    fontVariant: [...TABULAR_NUMS],
  },
  widgetActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  pinWidgetBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  pinWidgetText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  syncWidgetBtn: {
    flex: 1,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncWidgetText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
