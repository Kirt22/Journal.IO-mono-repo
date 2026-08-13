import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import AddWidgetDemoPhone from '../src/components/AddWidgetDemoPhone';
import { ADD_WIDGET_STEPS } from '../src/screens/profile/widgetInstructions';
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

async function render() {
  let root!: ReactTestRenderer.ReactTestRenderer;

  await act(async () => {
    root = ReactTestRenderer.create(
      <ThemeProvider modeOverride="light">
        <AddWidgetDemoPhone />
      </ThemeProvider>,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return root;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('plays the bundled recording instead of the written steps', async () => {
  const root = await render();

  const video = root.root.findByProps({ testID: 'add-widget-demo-video' });
  expect(video.props.muted).toBe(true);
  expect(video.props.repeat).toBe(true);
  expect(video.props.source).toBeTruthy();

  ADD_WIDGET_STEPS.forEach(step => {
    expect(extractText(root.toJSON())).not.toContain(step);
  });

  await act(async () => {
    root.unmount();
  });
});

test('falls back to the written steps when the recording cannot play', async () => {
  const root = await render();

  await act(async () => {
    root.root.findByProps({ testID: 'add-widget-demo-video' }).props.onError();
  });

  const text = extractText(root.toJSON());
  ADD_WIDGET_STEPS.forEach(step => {
    expect(text).toContain(step);
  });
  expect(
    root.root.findAllByProps({ testID: 'add-widget-demo-video' }),
  ).toHaveLength(0);

  await act(async () => {
    root.unmount();
  });
});

test('describes the steps to VoiceOver while the loop runs', async () => {
  const root = await render();

  const labels = root.root
    .findAllByProps({ accessible: true })
    .map(node => String(node.props.accessibilityLabel ?? ''));

  expect(
    labels.some(label =>
      ADD_WIDGET_STEPS.every(step => label.includes(step)),
    ),
  ).toBe(true);

  await act(async () => {
    root.unmount();
  });
});
