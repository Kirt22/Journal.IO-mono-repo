import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import MindMapRegionDetailModal, {
  type MindMapRegionModalData,
} from '../src/components/MindMapRegionDetailModal';
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

const REGION: MindMapRegionModalData = {
  id: 'planning_self_control',
  productLabel: 'Planning & Self-Control',
  brainRegionSubtitle: 'Prefrontal Cortex',
  signalScore: 0.62,
  shortInsight: 'A small next step appears meaningful for tomorrow.',
  actionStep: 'Try one repeatable reset this week.',
  evidence: ['carry forward'],
  description: 'Where planning and follow-through tend to show up.',
};

const renderModal = (props: Partial<
  React.ComponentProps<typeof MindMapRegionDetailModal>
> = {}) => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <MindMapRegionDetailModal
          onDismiss={jest.fn()}
          region={REGION}
          reduceMotionEnabled
          series={[]}
          seriesLoading={false}
          visible
          {...props}
        />
      </ThemeProvider>,
    );
  });

  return root;
};

const cleanup = (root: ReactTestRenderer.ReactTestRenderer) => {
  act(() => {
    root.unmount();
  });
};

test('locked Signal tab withholds the score instead of showing a placeholder one', () => {
  const root = renderModal({ locked: true, onUpgrade: jest.fn() });
  const text = extractText(root.toJSON());

  // The old design dimmed a hardcoded "72 / 100" behind a scrim, which reads as
  // this user's real score. Nothing numeric should survive on the locked tab.
  expect(text).not.toContain('72');
  expect(text).not.toContain('/ 100');
  expect(text).not.toContain('SIGNAL THIS PERIOD');
  expect(text).not.toContain(REGION.shortInsight!);
  expect(text).not.toContain(REGION.actionStep!);
  expect(text).toContain('Upgrade to see full insights');

  cleanup(root);
});

test('the locked upgrade prompt calls onUpgrade', () => {
  const onUpgrade = jest.fn();
  const root = renderModal({ locked: true, onUpgrade });

  act(() => {
    root.root
      .findByProps({ accessibilityLabel: 'Upgrade to see full insights' })
      .props.onPress();
  });

  expect(onUpgrade).toHaveBeenCalledTimes(1);

  cleanup(root);
});

test('an unlocked Signal tab still shows the real score and copy', () => {
  const root = renderModal();
  const text = extractText(root.toJSON());

  expect(text).toContain('62');
  expect(text).toContain('/ 100');
  expect(text).toContain(REGION.shortInsight!);
  expect(text).toContain(REGION.actionStep!);
  expect(text).not.toContain('Upgrade to see full insights');

  cleanup(root);
});
