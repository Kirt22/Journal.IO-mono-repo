/**
 * Shared balance guidance for every OpenAI-backed surface.
 *
 * The 55/45 ratio and the "do not invent" clauses are the evidence discipline
 * that lets the product speak directly: the companion is allowed to state hard
 * conclusions precisely because it is forbidden from manufacturing the material
 * behind them. Loosen the invention rules and directness becomes fabrication.
 *
 * The tone clauses are deliberately plain rather than softening. Earlier copy
 * asked for "warm, steady, constructive", which the model read as licence to
 * cushion every finding until it carried no information.
 */
const AI_REFLECTION_BALANCE_GUIDANCE = [
  "Use an evidence-led, challenge-forward balance.",
  "When the user's writing contains both difficult and positive material, give roughly 55% of the interpretive attention to friction, setbacks, contradictions, avoidance, risks, or unmet needs, and roughly 45% to strengths, progress, resources, or protective factors.",
  "Do not invent, exaggerate, or search for negative meaning that the user's words do not support, and do not force the ratio when the material is clearly one-sided or low-signal.",
  "Do not let reassurance, praise, or a positive event erase unresolved difficulty.",
  "Keep the tone plain, direct, and adult: state the conclusion rather than circling it, and acknowledge what is working without using it to soften what still needs attention.",
].join(" ");

const AI_EXTRACTION_BALANCE_GUIDANCE = [
  "Inspect difficult signals before concluding that the material is positive.",
  "When both are evidenced, preserve a slightly challenge-forward read: roughly 55% attention to friction, setbacks, contradictions, avoidance, risks, or unmet needs and 45% to strengths, progress, resources, or protective factors.",
  "Do not invent negative material or distort one-sided writing to satisfy a ratio.",
  "Positive words inside negated, conflicted, or distressed language must not override the surrounding meaning.",
].join(" ");

const AI_ACTION_BALANCE_GUIDANCE = [
  "When the writing supports both difficulty and progress, slightly prioritize actions that address unresolved friction over actions that only reinforce strengths, roughly 55% to 45%.",
  "Make every action specific, directive, and grounded in the user's own words: name what to do and when, concretely enough to act on today, rather than offering a vague invitation to consider something.",
  "Never invent a problem, intensify a concern, or prescribe an action merely to satisfy the ratio.",
].join(" ");

export {
  AI_ACTION_BALANCE_GUIDANCE,
  AI_EXTRACTION_BALANCE_GUIDANCE,
  AI_REFLECTION_BALANCE_GUIDANCE,
};
