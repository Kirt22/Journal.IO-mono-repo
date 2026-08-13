import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ScrollView, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import TabScreenLayout from '../src/components/TabScreenLayout';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderLayout = (
  ref: React.RefObject<ScrollView | null>,
  useAnimatedScroll: boolean,
) =>
  ReactTestRenderer.create(
    <SafeAreaProvider initialMetrics={metrics}>
      <TabScreenLayout
        backgroundColor="#FFFFFF"
        horizontalPadding={20}
        layoutMaxWidth={420}
        scrollViewRef={ref}
        useAnimatedScroll={useAnimatedScroll}
      >
        <Text>content</Text>
      </TabScreenLayout>
    </SafeAreaProvider>,
  );

test.each([
  ['plain ScrollView', false],
  ['Animated.ScrollView', true],
])('exposes an imperative scrollTo through the ref (%s)', (_label, animated) => {
  const ref = React.createRef<ScrollView>();
  let root: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    root = renderLayout(ref, animated as boolean);
  });

  expect(ref.current).toBeTruthy();
  expect(typeof ref.current?.scrollTo).toBe('function');

  ReactTestRenderer.act(() => root!.unmount());
});
