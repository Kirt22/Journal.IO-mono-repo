import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BrainMapNode } from "./brainMapTypes";
import type { BrainMapColors } from "./brainMapTheme";
import { withAlpha } from "./brainMapTheme";

type BrainNodeDetailsCardProps = {
  selectedNode: BrainMapNode | null;
  connectedNodes: BrainMapNode[];
  colors: BrainMapColors;
  onClearSelection: () => void;
};

function buildConnectionSentence(node: BrainMapNode, connectedNodes: BrainMapNode[]) {
  const connectedLabels = connectedNodes.slice(0, 3).map(connectedNode => connectedNode.label);

  if (!connectedLabels.length) {
    return "This pattern is not strongly connected in the current mock snapshot yet.";
  }

  const joinedLabels =
    connectedLabels.length === 1
      ? connectedLabels[0]
      : `${connectedLabels.slice(0, -1).join(", ")} and ${connectedLabels[connectedLabels.length - 1]}`;
  const reflectionCount = node.relatedEntryCount ?? 1;

  return `This pattern appears across ${reflectionCount} ${reflectionCount === 1 ? "reflection" : "reflections"} and is connected with ${joinedLabels}.`;
}

export default function BrainNodeDetailsCard({
  selectedNode,
  connectedNodes,
  colors,
  onClearSelection,
}: BrainNodeDetailsCardProps) {
  if (!selectedNode) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: withAlpha(colors.nodeHot, 0.16),
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: colors.muted }]}>
          MOCK SNAPSHOT
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>
          Select a glowing node
        </Text>
        <Text style={[styles.body, { color: colors.muted }]}>
          Tap a point in the graph to highlight connected thoughts, habits, goals, and contexts.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: withAlpha(colors.nodeHot, 0.24),
        },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardCopy}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>
            SELECTED NODE
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {selectedNode.label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onClearSelection}
          style={({ pressed }) => [
            styles.clearButton,
            {
              borderColor: withAlpha(colors.nodeHot, 0.2),
              backgroundColor: withAlpha(colors.nodeHot, 0.08),
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.clearButtonText, { color: colors.text }]}>
            Clear
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.body, { color: colors.text }]}>
        {selectedNode.explanation}
      </Text>
      <Text style={[styles.supportText, { color: colors.muted }]}>
        {buildConnectionSentence(selectedNode, connectedNodes)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  title: {
    marginTop: 3,
    fontSize: 20,
    fontWeight: "700",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  supportText: {
    fontSize: 13,
    lineHeight: 19,
  },
  clearButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
