import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import MindMapRegionDetailSheet from '../src/components/MindMapRegionDetailSheet';
import { getMindMapRegionEducation } from '../src/features/brainMap3D/mindMapEducation';
import { ThemeProvider } from '../src/theme/provider';

jest.mock('../src/services/hapticsService', () => ({
  triggerHaptic: jest.fn(async () => undefined),
}));

function extractText(node: unknown): string {
  if (node == null) {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractText).join('');
  }

  if (typeof node === 'object' && 'children' in node) {
    return extractText((node as { children?: unknown }).children);
  }

  return '';
}

test('renders session signal as an overall-style score and tier', () => {
  jest.useFakeTimers();
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <MindMapRegionDetailSheet
          education={getMindMapRegionEducation('planning_self_control')}
          onDismiss={jest.fn()}
          region={{
            productName: 'Planning & Self-Control',
            brainRegion: 'Prefrontal Cortex',
            score: 0.62,
            shortInsight: 'A small next step appears meaningful for tomorrow.',
            evidence: ['carry forward'],
          }}
          visible
        />
      </ThemeProvider>,
    );
  });
  act(() => {
    jest.runAllTimers();
  });

  const text = extractText(root.toJSON());
  expect(text).toContain('62 / 100');
  expect(text).toContain('High');
  expect(text).not.toContain('62%');

  act(() => {
    root.unmount();
  });
  jest.clearAllTimers();
  jest.useRealTimers();
});
