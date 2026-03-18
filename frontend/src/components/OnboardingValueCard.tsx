import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

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
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Icon color="#8E4636" size={18} strokeWidth={2} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E8DF',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: '#F3D8D0',
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
    color: '#1C221B',
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    color: '#556055',
    fontSize: 13,
    lineHeight: 18,
  },
});
