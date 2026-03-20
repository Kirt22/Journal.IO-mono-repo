import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/provider';

type OnboardingValueCardProps = {
  Icon: LucideIcon;
  title: string;
  description: string;
};

export function OnboardingValueCard({
  Icon,
  title,
  description,
}: OnboardingValueCardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={[styles.badge, { backgroundColor: theme.colors.accent }]}>
        <Icon color={theme.colors.primary} size={18} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.colors.foreground }]}>{title}</Text>
        <Text style={[styles.description, { color: theme.colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 12,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});
