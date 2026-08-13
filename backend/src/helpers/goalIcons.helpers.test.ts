import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_GOAL_ICON,
  GOAL_ICON_KEYS,
  isGoalIconKey,
  normalizeGoalIcon,
  resolveGoalIcon,
  resolveUniqueGoalIcon,
} from "./goalIcons.helpers";

test("the icon key list is unique and starts from the default", () => {
  assert.equal(new Set(GOAL_ICON_KEYS).size, GOAL_ICON_KEYS.length);
  assert.ok(GOAL_ICON_KEYS.includes(DEFAULT_GOAL_ICON));
});

test("isGoalIconKey guards the enum", () => {
  assert.equal(isGoalIconKey("peach"), true);
  assert.equal(isGoalIconKey("unicorn"), false);
  assert.equal(isGoalIconKey(undefined), false);
});

test("resolveGoalIcon matches plain subjects", () => {
  const cases: ReadonlyArray<[string, string]> = [
    ["Run three times a week", "run"],
    ["Walk after dinner", "walk"],
    ["Go to the gym on Tuesdays", "gym"],
    ["Sleep before midnight", "sleep"],
    ["Drink more water", "water"],
    ["Code with brother weekly", "code"],
    ["Read ten pages", "read"],
    // The person outranks the medium: "call mum" is a family goal.
    ["Call mum on Sunday", "family"],
    ["Call the dentist back", "call"],
    ["Meditate for five minutes", "meditate"],
    ["Journal every evening", "journal"],
    ["Water the plants", "water"],
  ];

  for (const [title, expected] of cases) {
    assert.equal(resolveGoalIcon(title), expected, title);
  }
});

test("resolveGoalIcon is case, punctuation and diacritic insensitive", () => {
  assert.equal(resolveGoalIcon("RUN!"), "run");
  assert.equal(resolveGoalIcon("  read,  daily  "), "read");
  assert.equal(resolveGoalIcon("Café less often"), "coffee");
});

test("resolveGoalIcon stems common verb endings", () => {
  assert.equal(resolveGoalIcon("Walking the dog"), "walk");
  assert.equal(resolveGoalIcon("Stretched every morning"), "stretch");
  assert.equal(resolveGoalIcon("Journals before bed"), "journal");
});

test("resolveGoalIcon does not substring-match inside longer words", () => {
  // The whole reason the matcher tokenizes instead of using indexOf/regex on the
  // raw string. Each of these would be a false positive under substring matching.
  const cases: ReadonlyArray<[string, string]> = [
    ["Host brunch for friends", "friends"], // "brunch" must not hit `run`
    ["Stop being a people pleaser", "social"], // "pleaser" must not hit `read`
    ["Try gymnastics classes", "study"], // "gymnastics" must not hit `gym`
  ];

  for (const [title, expected] of cases) {
    assert.equal(resolveGoalIcon(title), expected, title);
  }

  for (const title of [
    "Fix the changer cable",
    "Already enough for today",
    "Start a new habit",
  ]) {
    const icon = resolveGoalIcon(title);
    assert.equal(isGoalIconKey(icon), true);
    assert.equal(resolveGoalIcon(title), icon);
  }
});

test("resolveGoalIcon prefers the more specific key when both could match", () => {
  assert.equal(resolveGoalIcon("Less social media at night"), "social_media");
  assert.equal(resolveGoalIcon("Cut back on screen time"), "phone");
  assert.equal(resolveGoalIcon("Quit vaping"), "smoking", "vape beats breathe");
  assert.equal(resolveGoalIcon("Track my spending"), "spending", "spending beats money");
  assert.equal(resolveGoalIcon("Eat more vegetables"), "veggie", "veggie beats food");
  assert.equal(resolveGoalIcon("Block time for deep work"), "focus");
});

test("resolveGoalIcon ignores the direction of the intent", () => {
  // Documented behaviour: the icon labels the subject, not the stance.
  assert.equal(resolveGoalIcon("Cut down on coffee"), "coffee");
  assert.equal(resolveGoalIcon("More coffee mornings"), "coffee");
});

test("resolveGoalIcon gives non-empty generic titles a stable varied icon", () => {
  assert.notEqual(resolveGoalIcon("Zyzzyx qwertyuiop"), DEFAULT_GOAL_ICON);
  assert.equal(
    resolveGoalIcon("Zyzzyx qwertyuiop"),
    resolveGoalIcon("Zyzzyx qwertyuiop")
  );
  assert.equal(resolveGoalIcon(""), DEFAULT_GOAL_ICON);
  assert.equal(resolveGoalIcon("   "), DEFAULT_GOAL_ICON);
  assert.equal(resolveGoalIcon("!!!"), DEFAULT_GOAL_ICON);
  assert.equal(resolveGoalIcon(undefined as never), DEFAULT_GOAL_ICON);
});

test("resolveUniqueGoalIcon avoids an icon already in use", () => {
  assert.notEqual(
    resolveUniqueGoalIcon("Journal at night", ["journal"]),
    "journal"
  );
});

test("normalizeGoalIcon keeps valid keys and repairs invalid ones", () => {
  assert.equal(normalizeGoalIcon("peach"), "peach");
  assert.equal(normalizeGoalIcon("bogus", "Run every morning"), "run");
  assert.equal(normalizeGoalIcon(null, "Run every morning"), "run");
  assert.equal(normalizeGoalIcon(undefined), DEFAULT_GOAL_ICON);
});
