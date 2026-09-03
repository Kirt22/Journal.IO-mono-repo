const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);
const isProductionBuild =
  process.env.APP_ENV === 'production' ||
  process.env.BABEL_ENV === 'production' ||
  process.env.NODE_ENV === 'production' ||
  process.env.CONFIGURATION === 'Release';
const demoModeEnabled =
  process.env.DEMO_MODE_ENABLED === 'true' && !isProductionBuild;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    useWatchman: false,
  },
  server: {
    ...defaultConfig.server,
    rewriteRequestUrl: url => {
      const rewrittenUrl = defaultConfig.server.rewriteRequestUrl(url);
      if (!demoModeEnabled) return rewrittenUrl;

      return rewrittenUrl.replace(
        /^\/index\.(bundle|map)(?=\?|$)/,
        '/index.demo.$1',
      );
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
