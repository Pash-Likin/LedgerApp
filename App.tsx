import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AutoLedgerCenterModal } from './src/components/AutoLedgerCenterModal';
import { CaptureConfirmModal } from './src/components/CaptureConfirmModal';
import { TransactionModal } from './src/components/TransactionModal';
import { COLORS, RADIUS, SHADOW, SPACING } from './src/constants/theme';
import { LedgerProvider, useLedger } from './src/context/LedgerContext';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { ExportScreen } from './src/screens/ExportScreen';
import { LedgerScreen } from './src/screens/LedgerScreen';
import { StatsScreen } from './src/screens/StatsScreen';
import {
  autoLedger,
  type CapturedRecord,
  type LaunchAction,
} from './src/services/autoLedger';
import { triggerLightHaptic, triggerSelectionHaptic } from './src/services/haptics';
import type { TransactionWithCategory } from './src/types/ledger';

type TabKey = 'ledger' | 'stats' | 'export' | 'categories';

function MainShell() {
  const insets = useSafeAreaInsets();
  const { isInitializing, initError, refreshAll, syncAutoCaptures } = useLedger();

  const [activeTab, setActiveTab] = useState<TabKey>('ledger');
  const [txModalVisible, setTxModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionWithCategory | null>(null);
  const [autoCenterVisible, setAutoCenterVisible] = useState(false);
  const [reviewCapture, setReviewCapture] = useState<CapturedRecord | null>(null);

  const openCreateModal = useCallback(() => {
    triggerLightHaptic();
    setEditingTransaction(null);
    setTxModalVisible(true);
  }, []);

  const openEditModal = useCallback((tx: TransactionWithCategory) => {
    triggerSelectionHaptic();
    setEditingTransaction(tx);
    setTxModalVisible(true);
  }, []);

  const handleLaunchAction = useCallback(
    async (launch: LaunchAction) => {
      if (launch.action === 'quick_add') {
        openCreateModal();
        return;
      }
      if (launch.action === 'review_capture') {
        const latestPending = await syncAutoCaptures();
        const target =
          (launch.captureId
            ? latestPending.find((c) => c.id === launch.captureId)
            : undefined) ?? latestPending[0];
        if (target) {
          setReviewCapture(target);
        } else {
          setAutoCenterVisible(true);
        }
      }
    },
    [openCreateModal, syncAutoCaptures]
  );

  useEffect(() => {
    if (isInitializing || initError) return;
    const initialAction = autoLedger.consumeLaunchAction();
    if (initialAction) {
      handleLaunchAction(initialAction).catch(() => {});
    }
    return autoLedger.subscribeLaunchAction((launch) => {
      handleLaunchAction(launch).catch(() => {});
    });
  }, [isInitializing, initError, handleLaunchAction]);

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.bootContainer} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.bootText}>正在加载本地账本...</Text>
      </SafeAreaView>
    );
  }

  if (initError) {
    return (
      <SafeAreaView style={styles.bootContainer} edges={['top', 'bottom']}>
        <Ionicons name="alert-circle-outline" size={44} color={COLORS.expense} />
        <Text style={styles.errorTitle}>本地账本启动失败</Text>
        <Text style={styles.errorMsg}>{initError}</Text>
        <TouchableOpacity onPress={refreshAll} style={styles.retryBtn}>
          <Text style={styles.retryBtnText}>重试</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const switchTab = (tab: TabKey) => {
    if (tab === activeTab) return;
    triggerSelectionHaptic();
    setActiveTab(tab);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.screenBody}>
        {activeTab === 'ledger' ? (
          <LedgerScreen
            onOpenCreate={openCreateModal}
            onEditTransaction={openEditModal}
            onOpenAutoCenter={() => setAutoCenterVisible(true)}
            onReviewCapture={(capture) => setReviewCapture(capture)}
          />
        ) : activeTab === 'stats' ? (
          <StatsScreen onEditTransaction={openEditModal} />
        ) : activeTab === 'export' ? (
          <ExportScreen />
        ) : (
          <CategoriesScreen
            onOpenAutoCenter={() => setAutoCenterVisible(true)}
          />
        )}
      </View>

      {/* Bottom Tab Bar with Center FAB */}
      <View
        style={[
          styles.tabBar,
          { paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        <TouchableOpacity
          onPress={() => switchTab('ledger')}
          style={styles.tabItem}
          activeOpacity={0.75}
        >
          <Ionicons
            name={activeTab === 'ledger' ? 'receipt' : 'receipt-outline'}
            size={21}
            color={activeTab === 'ledger' ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'ledger' && styles.tabLabelActive,
            ]}
          >
            明细
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => switchTab('stats')}
          style={styles.tabItem}
          activeOpacity={0.75}
        >
          <Ionicons
            name={activeTab === 'stats' ? 'pie-chart' : 'pie-chart-outline'}
            size={21}
            color={activeTab === 'stats' ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'stats' && styles.tabLabelActive,
            ]}
          >
            统计
          </Text>
        </TouchableOpacity>

        <View style={styles.fabSlot}>
          <TouchableOpacity
            onPress={openCreateModal}
            style={styles.fabButton}
            activeOpacity={0.85}
            accessibilityLabel="记一笔"
          >
            <Ionicons name="add-outline" size={28} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.fabLabel}>记一笔</Text>
        </View>

        <TouchableOpacity
          onPress={() => switchTab('export')}
          style={styles.tabItem}
          activeOpacity={0.75}
        >
          <Ionicons
            name={activeTab === 'export' ? 'download' : 'download-outline'}
            size={21}
            color={activeTab === 'export' ? COLORS.primary : COLORS.textMuted}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'export' && styles.tabLabelActive,
            ]}
          >
            导出
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => switchTab('categories')}
          style={styles.tabItem}
          activeOpacity={0.75}
        >
          <Ionicons
            name={activeTab === 'categories' ? 'grid' : 'grid-outline'}
            size={21}
            color={
              activeTab === 'categories' ? COLORS.primary : COLORS.textMuted
            }
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'categories' && styles.tabLabelActive,
            ]}
          >
            分类
          </Text>
        </TouchableOpacity>
      </View>

      <TransactionModal
        visible={txModalVisible}
        editingTransaction={editingTransaction}
        onClose={() => {
          setTxModalVisible(false);
          setEditingTransaction(null);
        }}
      />

      <AutoLedgerCenterModal
        visible={autoCenterVisible}
        onClose={() => setAutoCenterVisible(false)}
        onReviewCapture={(capture) => {
          setAutoCenterVisible(false);
          setReviewCapture(capture);
        }}
      />

      <CaptureConfirmModal
        visible={reviewCapture !== null}
        capture={reviewCapture}
        onClose={() => setReviewCapture(null)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LedgerProvider>
        <MainShell />
      </LedgerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenBody: {
    flex: 1,
  },
  bootContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  bootText: {
    marginTop: SPACING.md,
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  errorTitle: {
    marginTop: SPACING.md,
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  errorMsg: {
    marginTop: 6,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  retryBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
    paddingHorizontal: SPACING.xs,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  fabSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  fabButton: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.pill,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -22,
    borderWidth: 3,
    borderColor: COLORS.surface,
    ...SHADOW.floating,
  },
  fabLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 2,
  },
});
