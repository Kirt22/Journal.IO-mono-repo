/**
 * @format
 */

import React from "react";
import ReactTestRenderer from "react-test-renderer";
import { Appearance, Text } from "react-native";
import { ThemeProvider } from "../src/theme/provider";

describe("ThemeProvider", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("syncs the native appearance to the app theme override", () => {
    const setColorSchemeSpy = jest.spyOn(Appearance, "setColorScheme");

    let renderer: ReactTestRenderer.ReactTestRenderer;

    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider modeOverride="dark">
          <Text>Journal.IO</Text>
        </ThemeProvider>
      );
    });

    expect(setColorSchemeSpy).toHaveBeenCalledWith("dark");

    ReactTestRenderer.act(() => {
      renderer!.update(
        <ThemeProvider modeOverride={null}>
          <Text>Journal.IO</Text>
        </ThemeProvider>
      );
    });

    expect(setColorSchemeSpy).toHaveBeenLastCalledWith("unspecified");
  });
});
