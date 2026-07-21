import type { BrainMapNodeType } from "./brainMapTypes";

export type BrainMapPoint3D = {
  x: number;
  y: number;
  z: number;
};

const DEFAULT_SEED = "journal-io-brain-map-v1";
const BRAIN_SCALE = {
  x: 2.25,
  y: 1.35,
  z: 1.35,
};
export const BRAIN_CONTOUR_SLICES = [
  { z: -1.3, scale: 0.48 },
  { z: -1.05, scale: 0.62 },
  { z: -0.8, scale: 0.76 },
  { z: -0.55, scale: 0.88 },
  { z: -0.28, scale: 0.96 },
  { z: 0, scale: 1 },
  { z: 0.28, scale: 0.96 },
  { z: 0.55, scale: 0.88 },
  { z: 0.82, scale: 0.76 },
  { z: 1.08, scale: 0.62 },
  { z: 1.3, scale: 0.5 },
] as const;

function createSeededRandom(seed: string) {
  let state = 0;

  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) % 2147483647;
  }

  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 48271) % 2147483647;

    return state / 2147483647;
  };
}

function isInsideBrainVolume(point: BrainMapPoint3D) {
  const insideMainLobe =
    (point.x / BRAIN_SCALE.x) ** 2 +
    ((point.y - 0.08) / 1.25) ** 2 +
    (point.z / 1.25) ** 2 <=
    1;
  const insideSideRearLobe =
    ((Math.abs(point.x) - 1.02) / 1.03) ** 2 +
    ((point.y - 0.02) / 1.04) ** 2 +
    ((point.z + 0.3) / BRAIN_SCALE.z) ** 2 <=
    1;
  const insideLowerTaper =
    (point.x / 0.65) ** 2 +
    ((point.y + 1.05) / 0.7) ** 2 +
    (point.z / 0.55) ** 2 <=
    1;
  const frontLowerBridge =
    (point.x / 1.08) ** 2 +
    ((point.y + 0.58) / 0.42) ** 2 +
    ((point.z - 0.5) / 0.68) ** 2 <=
    1;
  const softIndentation = point.x > 1.58 && point.y < -0.5 && point.z < -0.36;

  return (
    (insideMainLobe && !softIndentation) ||
    insideSideRearLobe ||
    insideLowerTaper ||
    frontLowerBridge
  );
}

function pullInsideBrainVolume(point: BrainMapPoint3D) {
  let adjustedPoint = point;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (isInsideBrainVolume(adjustedPoint)) {
      return adjustedPoint;
    }

    adjustedPoint = {
      x: adjustedPoint.x * 0.92,
      y: adjustedPoint.y * 0.92 - 0.02,
      z: adjustedPoint.z * 0.92,
    };
  }

  return adjustedPoint;
}

function typeTargetForNode(
  type: BrainMapNodeType,
  ordinal: number
): BrainMapPoint3D & { influence: number } {
  const side = ordinal % 2 === 0 ? -1 : 1;

  switch (type) {
    case "theme":
      return { x: side * 0.32, y: 0.38, z: ordinal % 4 === 0 ? -0.45 : 0.36, influence: 0.28 };
    case "emotion":
      return { x: side * 0.96, y: 0.02, z: ordinal % 3 === 0 ? -0.56 : 0.48, influence: 0.34 };
    case "habit":
      return { x: side * 0.42, y: -0.58, z: 0.58, influence: 0.36 };
    case "goal":
      return { x: 0.92, y: -0.16, z: 0.64, influence: 0.38 };
    case "tomorrow":
      return { x: 0.88, y: -0.74, z: 0.68, influence: 0.44 };
    case "context":
      return { x: side * 1.22, y: -0.02, z: -0.78, influence: 0.36 };
    case "entry":
    default:
      return { x: side * 0.34, y: -0.06, z: ordinal % 2 === 0 ? 0.52 : -0.42, influence: 0.18 };
  }
}

export function shapeBrainMapPositionForType3D(
  point: BrainMapPoint3D,
  type: BrainMapNodeType,
  ordinal: number
) {
  const target = typeTargetForNode(type, ordinal);
  const depthInfluence = target.influence * 0.45;
  const wobbleX = Math.sin((ordinal + 1) * 1.73) * 0.08;
  const wobbleY = Math.cos((ordinal + 2) * 1.19) * 0.05;
  const wobbleZ = Math.sin((ordinal + 3) * 1.37) * 0.07;

  return pullInsideBrainVolume({
    x: point.x * (1 - target.influence) + target.x * target.influence + wobbleX,
    y: point.y * (1 - target.influence) + target.y * target.influence + wobbleY,
    z: point.z * (1 - depthInfluence) + target.z * depthInfluence + wobbleZ,
  });
}

function chooseSliceIndex(random: () => number) {
  const roll = random();

  if (roll < 0.55) {
    return [4, 5, 6][Math.floor(random() * 3)];
  }

  if (roll < 0.8) {
    return random() > 0.5 ? 2 : 8;
  }

  if (roll < 0.92) {
    return [2, 3, 7, 8][Math.floor(random() * 4)];
  }

  return [4, 5, 6][Math.floor(random() * 3)];
}

function brainOutlineRadiusForAngle(angle: number, sliceIndex: number) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  let radius = 1 + Math.sin(angle * 2.3 + sliceIndex * 0.64) * 0.035;

  if (sine > 0) {
    radius += sine * 0.06;
  }

  if (cosine > 0.35 && sine > -0.28) {
    radius += cosine * 0.055;
  }

  if (cosine < -0.55 && sine < -0.05) {
    radius -= Math.abs(cosine) * 0.055;
  }

  if (sine < -0.35) {
    radius -= Math.abs(sine) * 0.12;
  }

  return Math.max(0.76, radius);
}

function createPointInsideSlice(
  random: () => number,
  sliceIndex: number,
  zoneRoll: number
): BrainMapPoint3D {
  const slice = BRAIN_CONTOUR_SLICES[sliceIndex];
  const isLowerTaper = zoneRoll >= 0.92;
  const isSideRear = zoneRoll >= 0.8 && zoneRoll < 0.92;
  const angle = isLowerTaper
    ? Math.PI * (1.18 + random() * 0.64)
    : random() * Math.PI * 2;
  const radial = Math.sqrt(random()) * (isSideRear ? 0.78 + random() * 0.18 : 0.9);
  const outlineRadius = brainOutlineRadiusForAngle(angle, sliceIndex);
  const sideBias = isSideRear ? (random() > 0.5 ? 1 : -1) * (0.16 + random() * 0.18) : 0;
  const lowerNarrowing = isLowerTaper ? 0.48 + random() * 0.2 : 1;
  const x =
    Math.cos(angle) * BRAIN_SCALE.x * slice.scale * outlineRadius * radial * lowerNarrowing +
    sideBias;
  const yCenter = 0.06 - (1 - slice.scale) * 0.08;
  const y =
    yCenter + Math.sin(angle) * BRAIN_SCALE.y * slice.scale * outlineRadius * radial;
  const zJitter = (random() - 0.5) * (isLowerTaper ? 0.1 : 0.16);

  return {
    x,
    y: isLowerTaper ? Math.min(y, -0.58 - random() * 0.42) : y,
    z: slice.z + zJitter,
  };
}

export function generateBrainLikeNodePositions3D(
  count: number,
  seed = DEFAULT_SEED
): BrainMapPoint3D[] {
  const random = createSeededRandom(seed);
  const points: BrainMapPoint3D[] = [];
  const maxAttempts = count * 120;
  let attempts = 0;

  while (points.length < count && attempts < maxAttempts) {
    attempts += 1;
    const zoneRoll = random();
    const candidate = createPointInsideSlice(random, chooseSliceIndex(random), zoneRoll);

    if (isInsideBrainVolume(candidate)) {
      points.push(candidate);
    }
  }

  while (points.length < count) {
    const angle = points.length * 2.399963229728653;
    const radius = 0.22 + (points.length / Math.max(count, 1)) * 1.65;
    const fallbackPoint = {
      x: Math.cos(angle) * Math.min(radius, 1.95),
      y: Math.sin(angle * 0.72) * 0.82 - 0.06,
      z: BRAIN_CONTOUR_SLICES[points.length % BRAIN_CONTOUR_SLICES.length].z,
    };

    points.push(pullInsideBrainVolume(fallbackPoint));
  }

  return points;
}

export function distanceBetweenBrainMapPoints(
  firstPoint: BrainMapPoint3D,
  secondPoint: BrainMapPoint3D
) {
  const deltaX = firstPoint.x - secondPoint.x;
  const deltaY = firstPoint.y - secondPoint.y;
  const deltaZ = firstPoint.z - secondPoint.z;

  return Math.sqrt(deltaX ** 2 + deltaY ** 2 + deltaZ ** 2);
}

export function closestBrainContourSliceIndex(z: number) {
  return BRAIN_CONTOUR_SLICES.reduce(
    (bestIndex, slice, index) => {
      const currentDistance = Math.abs(slice.z - z);
      const bestDistance = Math.abs(BRAIN_CONTOUR_SLICES[bestIndex].z - z);

      return currentDistance < bestDistance ? index : bestIndex;
    },
    0
  );
}
