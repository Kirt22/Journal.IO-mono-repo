import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/provider";

type JournalPromptCardProps = {
  prompt?: string | null;
};

export default function JournalPromptCard({
  prompt,
}: JournalPromptCardProps) {
  const theme = useTheme();

  if (!prompt) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.accent,
        },
      ]}
    >
      <Text style={[styles.label, { color: theme.colors.mutedForeground }]}>
        Prompt Used
      </Text>
      <Text style={[styles.prompt, { color: theme.colors.foreground }]}>
        {prompt}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  prompt: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
  },
});
