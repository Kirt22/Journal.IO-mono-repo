jest.mock("react-native-keychain", () => ({
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock("@notifee/react-native", () => require("@notifee/react-native/jest-mock"));

jest.mock(
  "@env",
  () => ({
    API_BASE_URL: "",
    GOOGLE_WEB_CLIENT_ID: "",
    GOOGLE_IOS_CLIENT_ID: "",
    REVENUECAT_IOS_API_KEY: "",
    REVENUECAT_ANDROID_API_KEY: "",
    REVENUECAT_ENTITLEMENT_ID: "premium",
  }),
  { virtual: true }
);

jest.mock("react-native-purchases", () => {
  const mockModule = {
    LOG_LEVEL: {
      DEBUG: "DEBUG",
      INFO: "INFO",
    },
    PACKAGE_TYPE: {
      ANNUAL: "ANNUAL",
      WEEKLY: "WEEKLY",
      MONTHLY: "MONTHLY",
      LIFETIME: "LIFETIME",
      CUSTOM: "CUSTOM",
      UNKNOWN: "UNKNOWN",
    },
    PURCHASES_ERROR_CODE: {
      PURCHASE_CANCELLED_ERROR: "1",
      NETWORK_ERROR: "10",
      PAYMENT_PENDING_ERROR: "20",
      CONFIGURATION_ERROR: "23",
      OFFLINE_CONNECTION_ERROR: "35",
    },
    isConfigured: jest.fn(async () => false),
    setLogLevel: jest.fn(async () => undefined),
    configure: jest.fn(),
    getAppUserID: jest.fn(async () => "anonymous"),
    logIn: jest.fn(async () => ({
      customerInfo: null,
      created: false,
    })),
    logOut: jest.fn(async () => null),
    getOfferings: jest.fn(async () => ({
      current: null,
      all: {},
    })),
    getCustomerInfo: jest.fn(async () => null),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
    addCustomerInfoUpdateListener: jest.fn(),
    removeCustomerInfoUpdateListener: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockModule,
    ...mockModule,
  };
});

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({
      data: {
        idToken: "mock-google-id-token",
      },
    })),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
    IN_PROGRESS: "IN_PROGRESS",
    PLAY_SERVICES_NOT_AVAILABLE: "PLAY_SERVICES_NOT_AVAILABLE",
  },
}));
