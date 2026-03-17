/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import LoginScreen from "../src/screens/LoginScreen";

test("renders the welcome-first auth flow", async () => {
  let root: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(
      <LoginScreen
        onSwitchToGoogle={jest.fn()}
        onSwitchToSignup={jest.fn()}
        onLoginSuccess={jest.fn()}
      />
    );
  });

  const tree = JSON.stringify(root!.toJSON());

  expect(tree).toContain("Continue with Phone Number");
  expect(tree).toContain("Welcome to your personal journal.");
});
