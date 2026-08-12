import HapticPressable from './HapticPressable';
import {
  useEffect,
  useRef,
  useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { Brain, X } from 'lucide-react-native';
import { withAlpha } from '../features/brainMap3D/brainMapTheme';
import type { MindMapRegionEducation } from '../features/brainMap3D/mindMapEducation';
import { getScoreTier } from '../features/brainMap3D/regionTier';
import { triggerHaptic } from '../services/hapticsService';
import { useTheme } from '../theme/provider';

type SheetTab = 'signal' | 'about';

export type MindMapRegionDetail = {
  productName: string;
  brainRegion: string;
  score: number;
  shortInsight: string;
  evidence: string[];
};

type Props = {
  visible: boolean;
  region: MindMapRegionDetail;
  education: MindMapRegionEducation;
  onDismiss: () => void;
};

export default function MindMapRegionDetailSheet({
  visible,
  region,
  education,
  onDismiss,
}: Props) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<SheetTab>('signal');
  const [isMounted, setIsMounted] = useState(visible);
  const [segmentedWidth, setSegmentedWidth] = useState(0);
  const transition = useRef(new Animated.Value(0)).current;
  const tabProgress = useRef(new Animated.Value(0)).current;
  const contentProgress = useRef(new Animated.Value(1)).current;
  const safeEvidence = region.evidence.filter(Boolean).slice(0, 3);
  const thumbWidth = Math.max(0, (segmentedWidth - 6) / 2);
  const scoreValue = Math.round(region.score * 100);
  const scoreTier = getScoreTier(scoreValue, theme.colors);

  useEffect(() => {
    if (visible) {
      setIsMounted(true);
      setActiveTab('signal');
      transition.setValue(0);
      requestAnimationFrame(() => {
        Animated.timing(transition, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    if (!isMounted) {
      return;
    }

    Animated.timing(transition, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setIsMounted(false);
      }
    });
  }, [isMounted, transition, visible]);

  useEffect(() => {
    Animated.timing(tabProgress, {
      toValue: activeTab === 'signal' ? 0 : 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    contentProgress.setValue(0);
    Animated.timing(contentProgress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeTab, contentProgress, tabProgress]);

  const selectTab = (tab: SheetTab) => {
    if (tab === activeTab) {
      return;
    }

    triggerHaptic('optionSelected').catch(() => undefined);
    setActiveTab(tab);
  };

  const dismiss = () => {
    triggerHaptic('back').catch(() => undefined);
    onDismiss();
  };

  if (!isMounted) {
    return null;
  }

  return (
    <Modal
      animationType="none"
      onRequestClose={dismiss}
      transparent
      visible={isMounted}
    >
      <View style={styles.modalRoot}>
        <Animated.View
          style={[styles.scrim, { opacity: transition.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}
        >
          <HapticPressable
            accessibilityLabel="Close Mind Map details"
            accessibilityRole="button"
            onPress={dismiss}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.card,
              transform: [
                {
                  translateY: transition.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
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
                REFLECTION SIGNAL
              </Text>
              <Text style={[styles.title, { color: theme.colors.foreground }]}>
                {region.productName}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>
                {region.brainRegion}
              </Text>
            </View>
            <HapticPressable
              accessibilityLabel="Close Mind Map details"
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
            <HapticPressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'signal' }}
              onPress={() => selectTab('signal')}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === 'signal'
                        ? theme.colors.foreground
                        : theme.colors.mutedForeground,
                  },
                ]}
              >
                AI signal
              </Text>
            </HapticPressable>
            <HapticPressable
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'about' }}
              onPress={() => selectTab('about')}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      activeTab === 'about'
                        ? theme.colors.foreground
                        : theme.colors.mutedForeground,
                  },
                ]}
              >
                About this area
              </Text>
            </HapticPressable>
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
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
            >
              {activeTab === 'signal' ? (
                <>
                  <View
                    style={[
                      styles.scoreCard,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                  >
                    <View style={styles.scoreCopy}>
                      <Text style={[styles.scoreLabel, { color: theme.colors.mutedForeground }]}>
                        YOUR FIRST-REFLECTION SIGNAL
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
                    <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
                      WHAT JOURNAL.IO NOTICED
                    </Text>
                    <Text style={[styles.body, { color: theme.colors.foreground }]}>
                      {region.shortInsight}
                    </Text>
                  </View>
                  {safeEvidence.length ? (
                    <View style={styles.section}>
                      <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>
                        FROM YOUR REFLECTION
                      </Text>
                      <View style={styles.evidenceList}>
                        {safeEvidence.map((item, index) => (
                          <View
                            key={`${item}-${index}`}
                            style={[
                              styles.evidenceChip,
                              { backgroundColor: theme.colors.secondary },
                            ]}
                          >
                            <Text style={[styles.evidenceText, { color: theme.colors.foreground }]}>
                              {item}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                  <Text style={[styles.disclaimer, { color: theme.colors.mutedForeground }]}>
                    This is a reflection signal from your writing, not a measure of brain activity.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.aboutTitleRow}>
                    <Brain color={theme.colors.primary} size={19} />
                    <Text style={[styles.aboutTitle, { color: theme.colors.foreground }]}>
                      {region.brainRegion}
                    </Text>
                  </View>
                  <InfoSection label="What it is" text={education.whatItIs} />
                  <InfoSection label="Often supports" text={education.oftenSupports} />
                  <InfoSection label="In everyday life" text={education.dailyCue} />
                  <Text style={[styles.disclaimer, { color: theme.colors.mutedForeground }]}>
                    This is a simple learning guide, not a diagnosis or a literal brain reading.
                  </Text>
                </>
              )}
            </ScrollView>
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
    paddingBottom: 30,
  },
  contentTransition: {
    flex: 1,
    minHeight: 0,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 18,
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
  grabber: {
    alignSelf: 'center',
    borderRadius: 99,
    height: 4,
    marginBottom: 14,
    width: 38,
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  score: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1.1,
    lineHeight: 40,
    marginTop: 3,
  },
  scoreCopy: {
    flex: 1,
  },
  scoreCard: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.85,
  },
  scoreOutOf: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(31, 25, 21, 0.38)',
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.9,
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
  segmentedControl: {
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 18,
    padding: 3,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    minHeight: 420,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
  },
  tab: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
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
});
