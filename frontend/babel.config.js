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
  const localEnvPath = path.join(__dirname, ".env.local");

  const envPath =
    shouldUseProductionEnv
      ? ".env.production"
      : shouldUseLocalEnv && fs.existsSync(localEnvPath)
        ? ".env.local"
        : ".env";

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
    ],
  };
};
