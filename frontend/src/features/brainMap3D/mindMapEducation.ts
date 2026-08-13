import type { BrainReflectionCenterId } from '../../services/guidedReflectionService';

export type MindMapRegionEducation = {
  whatItIs: string;
  oftenSupports: string;
  dailyCue: string;
};

const REGION_EDUCATION: Record<
  BrainReflectionCenterId,
  MindMapRegionEducation
> = {
  emotional_intensity: {
    whatItIs:
      'Amygdala is a brain-inspired reference point for emotional charge and significance.',
    oftenSupports:
      'It is often associated with noticing what feels urgent, important, or emotionally vivid.',
    dailyCue:
      'You may notice it when a moment keeps replaying or carries a strong emotional pull.',
  },
  planning_self_control: {
    whatItIs:
      'Prefrontal Cortex is a reference point for planning, choices, and intentional action.',
    oftenSupports:
      'It is often associated with organizing priorities and choosing a next step.',
    dailyCue:
      'You may notice it when you are weighing options or setting a small plan for tomorrow.',
  },
  memory_meaning: {
    whatItIs:
      'Hippocampus is a reference point for memory and the meaning we make from experience.',
    oftenSupports:
      'It is often associated with connecting a current moment to what happened before.',
    dailyCue:
      'You may notice it when a memory, lesson, or familiar pattern shapes your view of today.',
  },
  body_inner_signals: {
    whatItIs:
      'Insula is a reference point for body awareness and internal sensations.',
    oftenSupports:
      'It is often associated with noticing energy, rest, tension, or a felt sense of what is going on.',
    dailyCue:
      'You may notice it when your body gives you an early signal before you have fully named it.',
  },
  conflict_attention: {
    whatItIs:
      'Anterior Cingulate Cortex is a reference point for attention, friction, and competing pulls.',
    oftenSupports:
      'It is often associated with noticing conflict, focus shifts, and moments that need resolution.',
    dailyCue:
      'You may notice it when two priorities compete or your attention keeps returning to one tension.',
  },
  motivation_reward: {
    whatItIs:
      'Ventral Striatum is a reference point for motivation, progress, and what feels rewarding.',
    oftenSupports:
      'It is often associated with momentum, anticipation, and the effort behind a meaningful goal.',
    dailyCue:
      'You may notice it when a small win gives you energy or a task feels hard to begin.',
  },
  relationships_perspective: {
    whatItIs:
      'Temporoparietal Junction is a reference point for perspective, connection, and social context.',
    oftenSupports:
      'It is often associated with considering another person, their point of view, or your sense of belonging.',
    dailyCue:
      'You may notice it when a conversation, relationship, or imagined response shapes your day.',
  },
  self_reflection_identity: {
    whatItIs:
      'Default Mode Network is a reference point for inner narrative, self-reflection, and identity.',
    oftenSupports:
      'It is often associated with making sense of your values, personal story, and what matters to you.',
    dailyCue:
      'You may notice it when you are reflecting on who you are becoming or what you want to carry forward.',
  },
};

export function getMindMapRegionEducation(id: BrainReflectionCenterId) {
  return REGION_EDUCATION[id];
}
