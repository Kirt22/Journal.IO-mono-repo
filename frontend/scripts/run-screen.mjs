import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const [, , screenName = "onboarding", platform = "ios"] = process.argv;
const allowedScreens = new Set([
  "onboarding",
  "auth",
  "sign-in",
  "create-account",
  "verify-email",
  "profile",
  "home",
  "calendar",
]);
const allowedPlatforms = new Set(["ios", "android"]);

if (!allowedScreens.has(screenName)) {
  console.error(`Unknown screen: ${screenName}`);
  process.exit(1);
}

if (!allowedPlatforms.has(platform)) {
  console.error(`Unknown platform: ${platform}`);
  process.exit(1);
}

const frontendRoot = fileURLToPath(new URL("..", import.meta.url));
const configPath = fileURLToPath(new URL("../src/utils/devLaunchConfig.json", import.meta.url));
const launchConfig = {
  stage:
    screenName === "home" || screenName === "calendar"
      ? "main-app"
      : screenName === "profile"
        ? "profile"
        : screenName,
  activeTab: screenName === "calendar" ? "calendar" : "home",
  email: screenName === "profile" ? "debug@example.com" : null,
};

writeFileSync(configPath, `${JSON.stringify(launchConfig, null, 2)}\n`, "utf8");

const runCommand = platform === "ios" ? "react-native" : "react-native";
const runArgs = platform === "ios" ? ["run-ios"] : ["run-android"];

const child = spawn(runCommand, runArgs, {
  stdio: "inherit",
  shell: true,
  cwd: frontendRoot,
});

child.on("exit", code => {
  process.exit(code ?? 0);
});
