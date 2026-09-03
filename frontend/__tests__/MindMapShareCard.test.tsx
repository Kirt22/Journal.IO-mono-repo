import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import MindMapShareCard from '../src/components/MindMapShareCard';

jest.mock('../src/features/brainMap3D/webRenderer/WebMindMapView', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: unknown) => ReactModule.createElement(View, props),
  };
});

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

const REGION = {
  brainRegion: 'Prefrontal Cortex',
  label: 'Planning & Self-Control',
  regionId: 'planning_self_control',
  scorePercent: 61.6,
  shortInsight: 'A small next step appears meaningful for tomorrow.',
} as const;

test('shows the region, its score, its tier, and the insight', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = ReactTestRenderer.create(<MindMapShareCard region={REGION} />);
  });

  const text = extractText(root.toJSON());
  expect(text).toContain('journal.io');
  expect(text).toContain('Planning & Self-Control');
  expect(text).toContain('62 / 100');
  expect(text).toContain('High');
  expect(text).toContain('A small next step appears meaningful for tomorrow.');
  expect(root.root.findByProps({ numberOfLines: 3 })).toBeTruthy();

  // The card ends at the explanation: no eyebrow, no anatomical pill, no footer.
  expect(text).not.toContain('REFLECTION SIGNAL');
  expect(text).not.toContain('Prefrontal Cortex');
  expect(text).not.toContain('Mapped from my reflection');

  act(() => root.unmount());
});

test('captures at natural bounds so view-shot can render the card', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;

  act(() => {
    root = ReactTestRenderer.create(<MindMapShareCard region={REGION} />);
  });

  // An explicit capture rect makes drawViewHierarchyInRect unreliable on iOS.
  const options = root.root.findByProps({ collapsable: false }).parent?.props
    .options;
  expect(options).toMatchObject({ format: 'png', result: 'tmpfile' });
  expect(options.width).toBeUndefined();
  expect(options.height).toBeUndefined();

  act(() => root.unmount());
});

test('unmounts the live scene once its snapshot arrives', () => {
  let root!: ReactTestRenderer.ReactTestRenderer;
  const onReadyChange = jest.fn();

  act(() => {
    root = ReactTestRenderer.create(
      <MindMapShareCard onReadyChange={onReadyChange} region={REGION} />,
    );
  });

  const brainArea = root.root.find(
    node => typeof node.props.onLayout === 'function',
  );
  act(() => {
    brainArea.props.onLayout({
      nativeEvent: { layout: { height: 240, width: 300 } },
    });
  });

  const scene = root.root.findByProps({ presentationMode: 'share' });
  expect(scene.props.shareCaptureToken).toBeGreaterThan(0);
  expect(onReadyChange).toHaveBeenLastCalledWith(false);

  act(() => {
    scene.props.onShareSnapshot('data:image/png;base64,AAAA', {
      rank: 1,
      visible: true,
      x: 0.4,
      y: 0.35,
    });
  });

  // A live WKWebView in the tree makes the view-shot capture fail outright.
  expect(root.root.findAllByProps({ presentationMode: 'share' })).toHaveLength(0);
  // The pin is a DOM overlay in the scene, so the card redraws it over the image.
  expect(extractText(root.toJSON())).toContain('1');

  act(() => root.unmount());
});

// react-native-share resolves its native module with getEnforcing() at import
// time, so on a binary that has not linked it yet the import itself throws. If
// the card reaches it transitively, the whole screen red-boxes instead of just
// the share action failing.
test('renders without pulling in the share native module', () => {
  jest.isolateModules(() => {
    jest.doMock('react-native-share', () => {
      throw new Error(
        "TurboModuleRegistry.getEnforcing(...): 'RNShare' could not be found.",
      );
    });

    expect(() => require('../src/components/MindMapShareCard')).not.toThrow();
  });
});
