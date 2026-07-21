const fs = require("fs");
const path = require("path");

module.exports = api => {
  api.cache(false);

  const appEnv = process.env.APP_ENV?.trim();
  const shouldUseProductionEnv =
    appEnv === "production" ||
    process.env.BABEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.CONFIGURATION === "Release";
  const shouldUseLocalEnv = appEnv === "local";
  const shouldUseSimulatorEnv = appEnv === "simulator";
  const localEnvPath = path.join(__dirname, ".env.local");
  const simulatorEnvPath = path.join(__dirname, ".env.simulator");
  const productionEnvPath = path.join(__dirname, ".env.production");
  let envPath = ".env";

  if (shouldUseProductionEnv) {
    if (!fs.existsSync(productionEnvPath)) {
      throw new Error("APP_ENV=production requires frontend/.env.production.");
    }

    envPath = ".env.production";
  } else if (shouldUseLocalEnv) {
    if (!fs.existsSync(localEnvPath)) {
      throw new Error("APP_ENV=local requires frontend/.env.local.");
    }

    envPath = ".env.local";
  } else if (shouldUseSimulatorEnv) {
    if (!fs.existsSync(simulatorEnvPath)) {
      throw new Error("APP_ENV=simulator requires frontend/.env.simulator.");
    }

    envPath = ".env.simulator";
  }

  console.log(`[babel] react-native-dotenv loading ${envPath}`);

  return {
    presets: ["module:@react-native/babel-preset"],
    plugins: [
      [
        "module:react-native-dotenv",
        {
          moduleName: "@env",
          path: envPath,
          allowUndefined: true,
        },
      ],
      "react-native-worklets/plugin",
    ],
  };
};
