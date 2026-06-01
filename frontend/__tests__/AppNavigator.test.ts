import { getInitialRouteName } from "../src/navigation/AppNavigator";

describe("AppNavigator", () => {
  it("opens the auth choice screen when bootstrapped at the auth stage", () => {
    expect(getInitialRouteName("auth")).toBe("AuthChoice");
  });
});
