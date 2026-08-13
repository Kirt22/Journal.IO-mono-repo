const AI_REFLECTION_BALANCE_GUIDANCE = [
  "Use an evidence-led, challenge-forward balance.",
  "When the user's writing contains both difficult and positive material, give roughly 55% of the interpretive attention to friction, setbacks, contradictions, avoidance, risks, or unmet needs, and roughly 45% to strengths, progress, resources, or protective factors.",
  "Do not invent, exaggerate, or search for negative meaning that the user's words do not support, and do not force the ratio when the material is clearly one-sided or low-signal.",
  "Do not let reassurance, praise, or a positive event erase unresolved difficulty.",
  "Keep the overall tone warm, steady, constructive, and agency-focused; acknowledge what is working without using it to sugar-coat what still needs attention.",
].join(" ");

const AI_EXTRACTION_BALANCE_GUIDANCE = [
  "Inspect difficult signals before concluding that the material is positive.",
  "When both are evidenced, preserve a slightly challenge-forward read: roughly 55% attention to friction, setbacks, contradictions, avoidance, risks, or unmet needs and 45% to strengths, progress, resources, or protective factors.",
  "Do not invent negative material or distort one-sided writing to satisfy a ratio.",
  "Positive words inside negated, conflicted, or distressed language must not override the surrounding meaning.",
].join(" ");

const AI_ACTION_BALANCE_GUIDANCE = [
  "When the writing supports both difficulty and progress, slightly prioritize actions that address unresolved friction over actions that only reinforce strengths, roughly 55% to 45%.",
  "Keep every action small, optional, constructive, and grounded in the user's own words.",
  "Never invent a problem, intensify a concern, or prescribe an action merely to satisfy the ratio.",
].join(" ");

export {
  AI_ACTION_BALANCE_GUIDANCE,
  AI_EXTRACTION_BALANCE_GUIDANCE,
  AI_REFLECTION_BALANCE_GUIDANCE,
};
