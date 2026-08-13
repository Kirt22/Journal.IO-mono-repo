import { Image, StyleSheet } from 'react-native';

type AuthActionIconKind = 'create-account' | 'email' | 'reset-link';

type AuthActionIconProps = {
  kind: AuthActionIconKind;
};

const iconSources = {
  'create-account': require('../assets/png/auth/auth-create-account.png'),
  email: require('../assets/png/auth/auth-email.png'),
  'reset-link': require('../assets/png/auth/auth-reset-link.png'),
} as const;

export default function AuthActionIcon({ kind }: AuthActionIconProps) {
  return (
    <Image
      accessible={false}
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={iconSources[kind]}
      style={styles.icon}
      testID={`auth-${kind}-action-icon`}
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    height: 24,
    width: 24,
  },
});
