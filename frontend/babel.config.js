module.exports = api => {
  api.cache(false);

  const shouldUseProductionEnv =
    process.env.APP_ENV === "production" ||
    process.env.BABEL_ENV === "production" ||
    process.env.NODE_ENV === "production" ||
    process.env.CONFIGURATION === "Release";

  const envPath =
    shouldUseProductionEnv ? ".env.production" : ".env";

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
