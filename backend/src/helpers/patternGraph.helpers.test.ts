import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPatternEdgeKey,
  computeNodeStrength,
  isValidUmbrellaLabel,
  medianLagHours,
  patternGraphRefinementJsonSchema,
  patternGraphRefinementSchema,
  toPatternKey,
} from "./patternGraph.helpers";

test("toPatternKey collapses the same behaviour written three different ways", () => {
  const key = toPatternKey("avoids conflict");

  assert.equal(toPatternKey("avoiding conflict"), key);
  assert.equal(toPatternKey("conflict avoidance"), key);
  assert.equal(toPatternKey("Avoids the conflict."), key);
  assert.equal(key, "avoid|conflict");
});

test("toPatternKey keeps genuinely different behaviours apart", () => {
  const eating = toPatternKey("eats while watching shows");
  const scrolling = toPatternKey("scrolls before bed");

  assert.notEqual(eating, scrolling);
  assert.notEqual(toPatternKey("seeks reassurance after conflict"), toPatternKey("avoids conflict"));
});

test("toPatternKey does not over-stem words ending in a double s", () => {
  // "stress" -> "stres" would silently split a very common theme in two.
  assert.equal(toPatternKey("stress"), toPatternKey("stresses"));
  assert.equal(toPatternKey("stress"), "stress");
});

test("toPatternKey degrades to a stable fallback instead of an empty key", () => {
  assert.equal(toPatternKey("   "), "pattern");
  assert.equal(toPatternKey("the a an"), "pattern");
});

test("umbrella labels no longer filter clinical vocabulary", () => {
  // The clinical-term guard was removed deliberately: naming a recognised
  // pattern directly is the product's voice now. Filtering these dropped the
  // node entirely rather than rewording it, so the graph lost the pattern.
  assert.equal(isValidUmbrellaLabel("avoidant attachment disorder"), true);
  assert.equal(isValidUmbrellaLabel("work anxiety"), true);
  assert.equal(isValidUmbrellaLabel("depressive withdrawal"), true);
});

test("isValidUmbrellaLabel still requires a multi-word phrase", () => {
  assert.equal(isValidUmbrellaLabel("bracing for things going wrong"), true);
  assert.equal(isValidUmbrellaLabel("soothing tension with screens"), true);

  // The surviving rule is about specificity, not clinical language: a bare
  // state noun describes nothing the person actually does, whether or not the
  // word is a clinical one.
  assert.equal(isValidUmbrellaLabel("procrastination"), false);
  assert.equal(isValidUmbrellaLabel("anxiety"), false);
  assert.equal(isValidUmbrellaLabel(""), false);
});

test("buildPatternEdgeKey is order-stable for co_occurs and order-sensitive otherwise", () => {
  const forward = buildPatternEdgeKey("co_occurs", "screen|time", "eat|late");
  const reverse = buildPatternEdgeKey("co_occurs", "eat|late", "screen|time");

  assert.equal(forward.key, reverse.key, "an undirected pair must collapse to one row");
  assert.equal(forward.directed, false);

  const precedes = buildPatternEdgeKey("precedes", "screen|time", "eat|late");
  const precedesReverse = buildPatternEdgeKey("precedes", "eat|late", "screen|time");

  assert.notEqual(precedes.key, precedesReverse.key, "direction is the claim for precedes");
  assert.equal(precedes.directed, true);
  assert.equal(precedes.fromKey, "screen|time");
  assert.equal(precedes.toKey, "eat|late");
});

test("computeNodeStrength ranks a live pattern above an equally frequent stale one", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");
  const live = computeNodeStrength({
    occurrences: 6,
    confidence: 0.8,
    lastSeenAt: new Date("2026-08-09T00:00:00.000Z"),
    now,
  });
  const stale = computeNodeStrength({
    occurrences: 6,
    confidence: 0.8,
    lastSeenAt: new Date("2026-02-09T00:00:00.000Z"),
    now,
  });

  assert.ok(live > stale, `expected live (${live}) to outrank stale (${stale})`);
});

test("computeNodeStrength survives unusable inputs instead of producing NaN", () => {
  const strength = computeNodeStrength({
    occurrences: Number.NaN,
    confidence: Number.NaN,
    lastSeenAt: new Date("2026-08-11T00:00:00.000Z"),
    now: new Date("2026-08-11T00:00:00.000Z"),
  });

  assert.equal(Number.isFinite(strength), true);
  assert.equal(strength, 0);
});

test("medianLagHours handles odd, even, and empty sample sets", () => {
  assert.equal(medianLagHours([4, 10, 6]), 6);
  assert.equal(medianLagHours([4, 10, 6, 8]), 7);
  assert.equal(medianLagHours([]), null);
});

test("patternGraphRefinementSchema rejects malformed model output", () => {
  const validEdge = {
    fromKey: "screen|time",
    toKey: "eat|late",
    type: "precedes",
    rationale: "A screen-heavy evening often runs into eating past fullness.",
    evidenceQuote: "",
    confidence: 0.7,
  };

  assert.equal(
    patternGraphRefinementSchema.safeParse({ edges: [validEdge], umbrellas: [] }).success,
    true
  );

  // An unknown edge type must not slip through as a free-text relation.
  assert.equal(
    patternGraphRefinementSchema.safeParse({
      edges: [{ ...validEdge, type: "causes" }],
      umbrellas: [],
    }).success,
    false
  );

  // strict:true has no nullable, so evidenceQuote is "" when absent — but the
  // key itself must always be present.
  const { evidenceQuote: _omitted, ...withoutEvidence } = validEdge;
  assert.equal(
    patternGraphRefinementSchema.safeParse({ edges: [withoutEvidence], umbrellas: [] }).success,
    false
  );

  assert.equal(
    patternGraphRefinementSchema.safeParse({
      edges: [{ ...validEdge, confidence: 1.4 }],
      umbrellas: [],
    }).success,
    false
  );

  // An umbrella has to group at least two patterns to be a cluster at all.
  assert.equal(
    patternGraphRefinementSchema.safeParse({
      edges: [],
      umbrellas: [
        {
          label: "soothing tension with screens",
          rationale: "Several patterns point at screens as the way tension gets managed.",
          memberKeys: ["screen|time"],
          confidence: 0.7,
        },
      ],
    }).success,
    false
  );
});

test("patternGraphRefinementJsonSchema satisfies the Responses API strict-mode contract", () => {
  // strict:true requires every declared property to appear in `required` and
  // every object to forbid extra properties. A drift here makes the parser
  // reject *all* refinements, not just one field — cheap to guard, expensive
  // to miss.
  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") {
      return;
    }
    const schema = node as Record<string, unknown>;

    if (schema.type === "object") {
      assert.equal(
        schema.additionalProperties,
        false,
        `${path} must set additionalProperties: false`
      );

      const properties = (schema.properties || {}) as Record<string, unknown>;
      const required = (schema.required || []) as string[];
      const propertyNames = Object.keys(properties);

      assert.deepEqual(
        propertyNames.filter(name => !required.includes(name)),
        [],
        `${path} must list every property in required`
      );
      assert.deepEqual(
        required.filter(name => !propertyNames.includes(name)),
        [],
        `${path} requires a property it does not declare`
      );

      propertyNames.forEach(name => visit(properties[name], `${path}.${name}`));
      return;
    }

    if (schema.type === "array") {
      visit(schema.items, `${path}[]`);
    }
  };

  visit(patternGraphRefinementJsonSchema, "patternGraphRefinement");
});
