import { useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Download } from 'lucide-react-native';
import { exportAllEntries } from '../../services/privacyService';
import { useTheme } from '../../theme/provider';
import { ProfileSectionLayout, SectionCard } from './ProfileSectionLayout';
import ButtonLoadingContent from '../../components/ButtonLoadingContent';

type PrivacyScreenProps = {
  onBack: () => void;
};

function ExportActionButton({
  isExporting,
  onPress,
}: {
  isExporting: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityLabel={isExporting ? 'Preparing export' : 'Export all data'}
      accessibilityRole="button"
      accessibilityState={{ busy: isExporting, disabled: isExporting }}
      disabled={isExporting}
      onPress={onPress}
      style={({ pressed }) => [
        styles.exportButton,
        {
          backgroundColor: theme.colors.secondary,
          borderColor: theme.colors.border,
        },
        isExporting && styles.exportButtonDisabled,
        pressed && !isExporting && styles.exportButtonPressed,
      ]}
    >
      <ButtonLoadingContent
        contentStyle={styles.exportLabel}
        loaderColor={theme.colors.foreground}
        loading={isExporting}
      >
        <Download size={15} color={theme.colors.foreground} />
        <Text
          style={[styles.exportLabelText, { color: theme.colors.foreground }]}
        >
          Export all data
        </Text>
      </ButtonLoadingContent>
    </Pressable>
  );
}

export default function PrivacyScreen({ onBack }: PrivacyScreenProps) {
  const theme = useTheme();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);

    try {
      const exportData = await exportAllEntries();

      await Share.share({
        title: 'Journal.IO export',
        message: JSON.stringify(exportData, null, 2),
      });
    } catch (error) {
      Alert.alert(
        'Export data',
        error instanceof Error
          ? error.message
          : 'Unable to export your data right now.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ProfileSectionLayout title="Export data" onBack={onBack}>
      <SectionCard>
        <View style={styles.sectionHeader}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: `${theme.colors.primary}14` },
            ]}
          >
            <Download size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.title, { color: theme.colors.foreground }]}>
              Export your data
            </Text>
            <Text
              style={[styles.subtitle, { color: theme.colors.mutedForeground }]}
            >
              Your journal and settings.
            </Text>
          </View>
        </View>

        <Text
          style={[styles.description, { color: theme.colors.mutedForeground }]}
        >
          Save or share your JSON export from your device.
        </Text>

        <ExportActionButton isExporting={isExporting} onPress={handleExport} />
      </SectionCard>
    </ProfileSectionLayout>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  exportButton: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  exportButtonDisabled: {
    opacity: 0.72,
  },
  exportButtonPressed: {
    opacity: 0.9,
  },
  exportLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportLabelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
