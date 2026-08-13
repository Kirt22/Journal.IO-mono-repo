import assert from "node:assert/strict";
import test from "node:test";
import {
  detectJadeVisualization,
  flattenJadeBlocks,
  isUnsupportedJadeVisualization,
} from "./askJadeRichReply.service";

test("visualizations require an explicit request", () => {
  assert.equal(detectJadeVisualization("How has my mood been?"), null);
  assert.equal(detectJadeVisualization("Graph my mood this week"), "mood_trend_7d");
  assert.equal(
    detectJadeVisualization("Show an all-time mood breakdown"),
    "mood_distribution_all_time"
  );
  assert.equal(detectJadeVisualization("Show my journaling stats"), "summary_stats");
  assert.equal(detectJadeVisualization("Chart my writing activity"), "activity_7d");
  assert.equal(isUnsupportedJadeVisualization("Graph my emotions"), true);
  assert.equal(isUnsupportedJadeVisualization("Graph my mood and emotions"), false);
});

test("flattened rich replies remain useful to legacy clients", () => {
  const text = flattenJadeBlocks([
    { type: "text", text: "Here is a small summary." },
    { type: "list", style: "numbered", items: ["First pattern", "Second pattern"] },
    {
      type: "stats",
      title: "Your journal at a glance",
      dataState: "ready",
      updatedAt: null,
      items: [{ label: "Entries", value: "12" }],
    },
  ]);

  assert.match(text, /1\. First pattern/);
  assert.match(text, /Entries: 12/);
});
