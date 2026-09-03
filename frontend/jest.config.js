module.exports = {
  modulePathIgnorePatterns: ['<rootDir>/node_modules.broken/'],
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-navigation|@notifee|@shopify/react-native-skia|react-native-reanimated|react-native-worklets)',
  ],
};
