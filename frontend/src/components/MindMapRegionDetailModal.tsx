import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Modal,
  ScrollView,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { Brain, LineChart, X } from 'lucide-react-native';
import type { BrainReflectionCenterId } from '../services/guidedReflectionService';
import { getMindMapRegionEducation } from '../features/brainMap3D/mindMapEducation';
import { withAlpha } from '../features/brainMap3D/brainMapTheme';
import { getScoreTier } from '../features/brainMap3D/regionTier';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';
import RegionTrendChart, { type RegionTrendPoint } from './RegionTrendChart';
import JournalLoader from './JournalLoader';

const LOCK_ICON = require('../assets/png/entry/lock.png');

type ModalTab = 'signal' | 'about';

export type MindMapRegionModalData = {
  id: BrainReflectionCenterId;
  productLabel: string;
  brainRegionSubtitle: string;
  signalScore?: number | undefined;
  tierLabel?: string | undefined;
  shortInsight?: string | undefined;
  actionStep?: string | undefined;
  evidence?: string[] | undefined;
  trendLabel?: string | undefined;
  // Educational copy shown when there is no personal signal for a free user.
  description?: string | undefined;
};

type Props = {
  visible: boolean;
  region: MindMapRegionModalData | null;
  series: RegionTrendPoint[];
  seriesLoading: boolean;
  // When true for a free user, the Signal tab renders as a skeleton with an
  // upgrade prompt. The educational "About this area" tab stays fully visible.
  locked?: boolean;
  // When true the viewer already has premium but there is no personal signal
  // yet (the map is still building). The Signal tab says so plainly instead of
  // showing a paywall the user has already passed. Takes precedence over
  // `locked`.
  signalPending?: boolean;
  reduceMotionEnabled?: boolean;
  onUpgrade?: () => void;
  onDismiss: () => void;
};

// Full-detail bottom sheet for a single region on the aggregate Mind Map. Both
// tabs (Signal + About this area) always render; the sheet keeps a fixed height
// so switching tabs never resizes it, and the content crossfades/slides between
// tabs. Free users see the Signal tab as a skeleton with an upgrade prompt.
export default function MindMapRegionDetailModal({
  visible,
  region,
  series,
  seriesLoading,
  locked = false,
  signalPending = false,
  reduceMotionEnabled = false,
  onUpgrade,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<ModalTab>('signal');
  const [isMounted, setIsMounted] = useState(visible);
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const transition = useRef(new Animated.Value(0)).current;
  // Crossfade + slide between the two tabs' content, without resizing the sheet.
  const contentProgress = useRef(new Animated.Value(1)).current;
  // Sliding highlight thumb behind the active segmented-control tab.
  const tabProgress = useRef(new Animated.Value(0)).current;
  // 3px padding either side of the two equal-width tabs.
  const thumbWidth = Math.max(0, (segmentedWidth - 6) / 2);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setActiveTab('signal');
      transition.setValue(reduceMotionEnabled ? 1 : 0);
      if (!reduceMotionEnabled) {
        requestAnimationFrame(() => {
          Animated.timing(transition, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        });
      }
      return;
    }

    if (!isMounted) {
      return;
    }

    if (reduceMotionEnabled) {
      setIsMounted(false);
      return;
    }

    Animated.timing(transition, {
      toValue: 0,
      duration: 170,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [isMounted, reduceMotionEnabled, transition, visible]);

  // Animate the tab content + the sliding thumb when the selected tab changes.
  useEffect(() => {
    const thumbTarget = activeTab === 'signal' ? 0 : 1;

    if (reduceMotionEnabled) {
      contentProgress.setValue(1);
      tabProgress.setValue(thumbTarget);
      return;
    }

    Animated.timing(tabProgress, {
      toValue: thumbTarget,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    contentProgress.setValue(0);
    Animated.timing(contentProgress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, contentProgress, tabProgress, reduceMotionEnabled]);

  const dismiss = () => {
    triggerHaptic('back').catch(() => undefined);
    onDismiss();
  };

  const selectTab = (tab: ModalTab) => {
    if (tab === activeTab) {
      return;
    }
    triggerHaptic('optionSelected').catch(() => undefined);
    setActiveTab(tab);
  };

  const handleUpgrade = () => {
    triggerHaptic('optionSelected').catch(() => undefined);
    onUpgrade?.();
  };

  if (!isMounted || !region) {
    return null;
  }

  const education = getMindMapRegionEducation(region.id);
  const evidence = (region.evidence ?? []).filter(Boolean).slice(0, 3);
  const signalPercent = Math.round((region.signalScore ?? 0) * 100);

  const scoreValue = signalPercent;
  const scoreTier = getScoreTier(scoreValue, theme.colors);

  // Only reached when unlocked — the locked tab renders a skeleton instead.
  const renderSignalContent = () => (
    <>
      <View style={[styles.scoreCard, { backgroundColor: theme.colors.secondary }]}>
        <View style={styles.scoreCopy}>
          <Text style={[styles.scoreLabel, { color: theme.colors.mutedForeground }]}>
            SIGNAL THIS PERIOD
          </Text>
          <Text style={[styles.score, { color: theme.colors.foreground }]}>
            {scoreValue}
            <Text style={[styles.scoreOutOf, { color: theme.colors.mutedForeground }]}>
              {' '}
              / 100
            </Text>
          </Text>
        </View>
        <View
          style={[
            styles.tierChip,
            { backgroundColor: withAlpha(scoreTier.color, 0.16) },
          ]}
        >
          <Text style={[styles.tierText, { color: scoreTier.color }]}>
            {scoreTier.label}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <LineChart color={theme.colors.primary} size={15} />
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
            HOW THIS AREA HAS DEVELOPED
          </Text>
        </View>
        {seriesLoading ? (
          <View style={styles.chartLoading}>
            <JournalLoader color={theme.colors.primary} />
          </View>
        ) : (
          <RegionTrendChart
            points={series}
            color={theme.colors.primary}
            gridColor={theme.colors.border}
            labelColor={theme.colors.mutedForeground}
          />
        )}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
          WHAT JOURNAL.IO NOTICED
        </Text>
        <Text style={[styles.body, { color: theme.colors.foreground }]}>
          {region.shortInsight}
        </Text>
        {region.trendLabel ? (
          <Text style={[styles.trendText, { color: theme.colors.mutedForeground }]}>
            {region.trendLabel}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
          A STEP TO TRY
        </Text>
        <Text style={[styles.body, { color: theme.colors.foreground }]}>
          {region.actionStep ?? education.dailyCue}
        </Text>
      </View>

      {evidence.length ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
            FROM YOUR ENTRIES
          </Text>
          <View style={styles.evidenceList}>
            {evidence.map((item, index) => (
              <View
                key={`${item}-${index}`}
                style={[styles.evidenceChip, { backgroundColor: theme.colors.secondary }]}
              >
                <Text style={[styles.evidenceText, { color: theme.colors.foreground }]}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </>
  );

  // The locked Signal tab renders the *shape* of the real tab, not a dimmed
  // copy of it. Placeholder numbers behind a scrim read as this user's score;
  // blank bars read as something being withheld, which is what is true. They
  // stay still: a sweep would claim the content is loading, and it isn't.
  const renderLockedSignalSkeleton = () => {
    const baseColor = withAlpha(
      theme.colors.mutedForeground,
      theme.mode === 'dark' ? 0.22 : 0.14,
    );
    const bar = (style: StyleProp<ViewStyle>, key?: string) => (
      <View key={key} style={[style, { backgroundColor: baseColor }]} />
    );

    return (
      <View style={styles.skeletonStack} pointerEvents="none">
        <View style={styles.skeletonScoreRow}>
          <View style={styles.skeletonScoreCopy}>
            {bar(styles.skeletonLabel)}
            {bar(styles.skeletonScore)}
          </View>
          {bar(styles.skeletonTierChip)}
        </View>

        {bar(styles.skeletonChart)}

        <View style={styles.skeletonLines}>
          {bar(styles.skeletonLabel, 'noticed-label')}
          {bar(styles.skeletonBodyLine, 'noticed-1')}
          {bar(styles.skeletonBodyLineShort, 'noticed-2')}
        </View>

        <View style={styles.skeletonLines}>
          {bar(styles.skeletonLabel, 'step-label')}
          {bar(styles.skeletonBodyLine, 'step-1')}
          {bar(styles.skeletonBodyLineShort, 'step-2')}
        </View>
      </View>
    );
  };

  // Premium viewer, no signal yet: nothing is being withheld, so there are no
  // placeholder bars and no upgrade prompt — just a plain statement of where
  // the map is, in the same card frame the locked state uses.
  const renderPendingSignalCard = () => (
    <View style={styles.lockedWrap}>
      <View
        style={[
          styles.lockedCard,
          styles.pendingCard,
          {
            backgroundColor: theme.colors.secondary,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <LineChart color={theme.colors.primary} size={20} />
        <Text style={[styles.pendingTitle, { color: theme.colors.foreground }]}>
          Your personalised signals aren't ready yet
        </Text>
        <Text
          style={[styles.pendingBody, { color: theme.colors.mutedForeground }]}
        >
          Journal.IO needs a few more entries before it can map this area for
          you. Keep journaling and your signals will appear here.
        </Text>
      </View>
    </View>
  );

  const renderAboutContent = () => (
    <>
      {(locked || signalPending) && region.description ? (
        <Text style={[styles.body, { color: theme.colors.foreground }]}>
          {region.description}
        </Text>
      ) : null}
      <View style={styles.aboutTitleRow}>
        <Brain color={theme.colors.primary} size={19} />
        <Text style={[styles.aboutTitle, { color: theme.colors.foreground }]}>
          {region.brainRegionSubtitle}
        </Text>
      </View>
      <InfoSection label="What it is" text={education.whatItIs} />
      <InfoSection label="Often supports" text={education.oftenSupports} />
      <InfoSection label="In everyday life" text={education.dailyCue} />
    </>
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      transparent
      visible={isMounted}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.scrim, { opacity: transition }]}>
          <HapticPressable
            accessibilityLabel="Close region details"
            accessibilityRole="button"
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.card,
              transform: [
                {
                  translateY: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [480, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: theme.colors.border }]} />
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={[styles.eyebrow, { color: theme.colors.primary }]}>
                REFLECTION REGION
              </Text>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {region.productLabel}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
                {region.brainRegionSubtitle}
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close region details"
              accessibilityRole="button"
              onPress={dismiss}
              style={({ pressed }) => [
                styles.closeButton,
                { borderColor: theme.colors.border },
                pressed && styles.pressed,
              ]}
            >
              <X color={theme.colors.foreground} size={18} />
            </HapticPressable>
          </View>

          <View
            onLayout={event => setSegmentedWidth(event.nativeEvent.layout.width)}
            style={[
              styles.segmentedControl,
              {
                backgroundColor: theme.colors.secondary,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segmentThumb,
                {
                  backgroundColor: theme.colors.card,
                  width: thumbWidth,
                  transform: [
                    {
                      translateX: tabProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, thumbWidth],
                      }),
                    },
                  ],
                },
              ]}
            />
            {(['signal', 'about'] as ModalTab[]).map(tab => (
              <HapticPressable
                key={tab}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeTab === tab }}
                onPress={() => selectTab(tab)}
                style={styles.tab}
              >
                <Text
                  style={[
                    styles.tabText,
                    {
                      color:
                        activeTab === tab
                          ? theme.colors.foreground
                          : theme.colors.mutedForeground,
                    },
                  ]}
                >
                  {tab === 'signal' ? 'Signal' : 'About this area'}
                </Text>
              </HapticPressable>
            ))}
          </View>

          <Animated.View
            style={[
              styles.contentTransition,
              {
                opacity: contentProgress,
                transform: [
                  {
                    translateY: contentProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {activeTab === 'signal' && signalPending ? (
              renderPendingSignalCard()
            ) : activeTab === 'signal' && locked ? (
              // One bounded card holding the placeholder, with the prompt
              // centred inside it. Loose full-height bars read as a broken
              // screen; a single card reads as one piece of content being held
              // back. `box-none` so only the button takes touches.
              <View style={styles.lockedWrap}>
                <View
                  style={[
                    styles.lockedCard,
                    {
                      backgroundColor: theme.colors.secondary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {renderLockedSignalSkeleton()}
                  <View pointerEvents="box-none" style={styles.lockedOverlay}>
                    <HapticPressable
                      accessibilityRole="button"
                      accessibilityLabel="Upgrade to see full insights"
                      onPress={handleUpgrade}
                      style={({ pressed }) => [
                        styles.upgradeButton,
                        { backgroundColor: theme.colors.primary },
                        pressed && styles.pressed,
                      ]}
                    >
                      <Image
                        accessibilityIgnoresInvertColors
                        source={LOCK_ICON}
                        style={styles.upgradeLockIcon}
                      />
                      <Text
                        style={[
                          styles.upgradeButtonText,
                          { color: theme.colors.primaryForeground },
                        ]}
                      >
                        Upgrade to see full insights
                      </Text>
                    </HapticPressable>
                  </View>
                </View>
              </View>
            ) : (
              <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
              >
                {activeTab === 'signal'
                  ? renderSignalContent()
                  : renderAboutContent()}
              </ScrollView>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function InfoSection({ label, text }: { label: string; text: string }) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
        {label.toUpperCase()}
      </Text>
      <Text style={[styles.body, { color: theme.colors.foreground }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aboutTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  aboutTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    // Fixed height so switching tabs never resizes / collapses the sheet.
    height: '82%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    width: '100%',
  },
  grabber: {
    alignSelf: 'center',
    borderRadius: 99,
    height: 4,
    marginBottom: 14,
    width: 38,
  },
  chartLoading: {
    alignItems: 'center',
    height: 150,
    justifyContent: 'center',
  },
  closeButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  content: {
    gap: 18,
    paddingBottom: 24,
  },
  contentTransition: {
    flex: 1,
    minHeight: 0,
  },
  evidenceChip: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  evidenceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  evidenceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 3,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 16,
    marginBottom: 18,
  },
  lockedCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  // Pinned to the top so the card starts directly under the tab toggle, the
  // same place the real Signal content starts. Centring it left a gap that read
  // as a layout bug rather than a deliberate hold.
  lockedWrap: {
    flex: 1,
    justifyContent: 'flex-start',
    minHeight: 0,
    // Clips rather than bleeding past the sheet on a short device or at a large
    // text scale, where the card can outgrow the tab area.
    overflow: 'hidden',
    paddingBottom: 24,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pendingBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  pendingCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  score: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.1,
    lineHeight: 40,
    marginTop: 3,
  },
  scoreOutOf: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0,
  },
  scoreCard: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  scoreCopy: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.85,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31, 25, 21, 0.42)',
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  segmentedControl: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 3,
  },
  segmentThumb: {
    borderRadius: 13,
    bottom: 3,
    left: 3,
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    top: 3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  tab: {
    alignItems: 'center',
    borderRadius: 13,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tierChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tierText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 26,
  },
  trendText: {
    fontSize: 13,
    lineHeight: 19,
  },
  skeletonStack: {
    gap: 20,
  },
  skeletonScoreRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonScoreCopy: {
    gap: 8,
  },
  skeletonLines: {
    gap: 10,
  },
  skeletonLabel: {
    width: 116,
    height: 11,
    borderRadius: 999,
  },
  skeletonScore: {
    width: 92,
    height: 26,
    borderRadius: 8,
  },
  skeletonTierChip: {
    width: 72,
    height: 24,
    borderRadius: 999,
  },
  skeletonChart: {
    width: '100%',
    height: 116,
    borderRadius: 14,
  },
  skeletonBodyLine: {
    width: '100%',
    height: 12,
    borderRadius: 999,
  },
  skeletonBodyLineShort: {
    width: '68%',
    height: 12,
    borderRadius: 999,
  },
  upgradeButton: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  upgradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeLockIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
});
