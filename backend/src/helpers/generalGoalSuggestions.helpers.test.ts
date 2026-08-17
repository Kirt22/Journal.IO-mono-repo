import assert from "node:assert/strict";
import test from "node:test";
import {
  assessGoalSignal,
  buildEntryBaselineGoals,
  buildGeneralBaselineGoals,
  GENERAL_BASELINE_GOALS,
} from "./generalGoalSuggestions.helpers";
import { GOAL_ICON_KEYS } from "./goalIcons.helpers";
import { GOAL_FREQUENCIES } from "./goalPeriod.helpers";

test("a long but hedged entry is still general", () => {
  const signal = assessGoalSignal(
    "Today was fine I guess. Work was work, same as usual, nothing much happened. " +
      "Got home, sat around, whatever. Kind of a boring day, not much to say about it. " +
      "Just another day really, same old thing all over again."
  );

  assert.equal(signal.level, "general");
});

test("a short entry that names a real situation is specific", () => {
  const signal = assessGoalSignal(
    "Work felt heavy and stressful today. I want a calmer reset and one simpler plan for tomorrow."
  );

  assert.equal(signal.level, "specific");
  assert.deepEqual(signal.domains, ["work"]);
});

test("an argument with a partner is specific even when brief", () => {
  const signal = assessGoalSignal(
    "Had a fight with my girlfriend about money again and I feel awful about it."
  );

  assert.equal(signal.level, "specific");
  assert.ok(signal.domains.includes("partner"));
});

test("empty and noise entries are general", () => {
  assert.equal(assessGoalSignal("").level, "general");
  assert.equal(assessGoalSignal("asdkjhasd asdkjh aaaaaaa").level, "general");
});

test("baseline goals lead with movement", () => {
  const goals = buildGeneralBaselineGoals("today was fine", 3);

  assert.equal(goals.length, 3);
  assert.equal(goals[0]?.title, "Walk 20 minutes");
  assert.equal(goals[1]?.title, "Hit 5,000 steps");
});

test("baseline goals move sleep and stress support up when mentioned", () => {
  const tired = buildGeneralBaselineGoals(
    "so tired again, could not sleep at all",
    12
  );

  assert.ok(
    tired.slice(0, 4).some((goal) => goal.title === "Wake at the same time"),
    "a sleep goal is promoted for a tired entry"
  );

  const stressed = buildGeneralBaselineGoals("everything feels overwhelming", 12);

  assert.ok(
    stressed
      .slice(0, 4)
      .some((goal) => goal.title === "Take 2 slow-breath minutes"),
    "a settling goal is promoted for a stressed entry"
  );
});

test("entry baseline goals drop the display-only category", () => {
  const goals = buildEntryBaselineGoals("today was fine", 2);

  for (const goal of goals) {
    assert.equal("category" in goal, false);
    assert.equal("themes" in goal, false);
  }
});

test("every baseline goal is renderable by both goal paths", () => {
  const titles = new Set<string>();

  for (const goal of GENERAL_BASELINE_GOALS) {
    assert.ok(
      (GOAL_ICON_KEYS as readonly string[]).includes(goal.icon),
      `${goal.title} uses a curated icon key`
    );
    assert.ok(
      (GOAL_FREQUENCIES as readonly string[]).includes(goal.frequency),
      `${goal.title} uses a valid frequency`
    );
    // The guided path validates 30/96; the entry path allows more. Staying
    // inside the tighter limit keeps one bank valid for both.
    assert.ok(goal.title.length <= 30, `${goal.title} fits a goal card title`);
    assert.ok(
      goal.description.length <= 96,
      `${goal.title} has a description within 96 characters`
    );
    assert.equal(titles.has(goal.title), false, "bank titles are unique");
    titles.add(goal.title);
  }
});
