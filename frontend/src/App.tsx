import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "./infrastructure/reactNative";
import AuthScreen from "./screens/AuthScreen";

const App = () => {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AuthScreen />
    </SafeAreaProvider>
  );
};

export default App;
