/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { OnboardingScreen } from "../src/screens/onboarding/OnboardingScreen";

test("renders the onboarding entry point", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <OnboardingScreen isCompleting={false} onContinue={jest.fn()} />
    );
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Welcome to Journal.IO");
  expect(tree).toContain("Continue");
});
