import HapticPressable from './HapticPressable';
import {
  StyleSheet,
  View,
} from 'react-native';
import {
  Text,
} from '../infrastructure/reactNative';
import { Crown } from 'lucide-react-native';
import { useTheme } from '../theme/provider';

type PremiumUpgradeCardProps = {
  accessibilityLabel: string;
  description: string;
  onPress: () => void;
  title: string;
  actionLabel?: string;
};

export default function PremiumUpgradeCard({
  accessibilityLabel,
  actionLabel = 'Explore Premium',
  description,
  onPress,
  title,
}: PremiumUpgradeCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.accent,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[styles.iconWrap, { backgroundColor: theme.colors.primary }]}
        >
          <Crown size={18} color={theme.colors.primaryForeground} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.colors.foreground }]}>
            {title}
          </Text>
          <Text
            style={[
              styles.description,
              { color: theme.colors.mutedForeground },
            ]}
          >
            {description}
          </Text>
        </View>
      </View>
      <HapticPressable
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [
          styles.action,
          { backgroundColor: theme.colors.primary },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[styles.actionText, { color: theme.colors.primaryForeground }]}
        >
          {actionLabel}
        </Text>
      </HapticPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  action: {
    alignItems: 'center',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 42,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.86,
  },
});
