import { CloudOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Text } from '../infrastructure/reactNative';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '../hooks/useConnectivity';
import { useTheme } from '../theme/provider';

export default function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { status } = useConnectivity();

  if (status !== 'offline') {
    return null;
  }

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      testID="offline-banner"
      style={[
        styles.banner,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          top: insets.top + 6,
        },
      ]}
    >
      <CloudOff color={theme.colors.primary} size={15} strokeWidth={2.2} />
      <Text style={[styles.label, { color: theme.colors.foreground }]}>
        Offline - reconnect to save changes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    elevation: 5,
    flexDirection: 'row',
    gap: 7,
    left: 20,
    maxWidth: 360,
    paddingHorizontal: 13,
    paddingVertical: 8,
    position: 'absolute',
    right: 20,
    shadowColor: '#000000',
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    zIndex: 80,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
