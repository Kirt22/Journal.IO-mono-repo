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
    REVENUECAT_MAIN_PAYWALL_OFFERING_ID: "",
    REVENUECAT_EXIT_PAYWALL_OFFERING_ID: "",
    REVENUECAT_OTHER_SCREENS_OFFERING_ID: "",
    REVENUECAT_LIFETIME_OFFERING_ID: "",
  }),
  { virtual: true }
);

jest.mock(
  "react-native-purchases-ui",
  () => {
    const PAYWALL_RESULT = {
      NOT_PRESENTED: "NOT_PRESENTED",
      ERROR: "ERROR",
      CANCELLED: "CANCELLED",
      PURCHASED: "PURCHASED",
      RESTORED: "RESTORED",
    };

    return {
      __esModule: true,
      PAYWALL_RESULT,
      default: {
        Paywall: jest.fn(() => null),
        presentPaywall: jest.fn(async () => PAYWALL_RESULT.CANCELLED),
      },
    };
  },
  { virtual: true }
);

jest.mock("react-native-webview", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

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

jest.mock("@invertase/react-native-apple-authentication", () => {
  const appleAuth = {
    Error: {
      CANCELED: "1001",
    },
    Operation: {
      LOGIN: "LOGIN",
    },
    Scope: {
      EMAIL: "EMAIL",
      FULL_NAME: "FULL_NAME",
    },
    isSupported: true,
    performRequest: jest.fn(async () => ({
      identityToken: "mock-apple-identity-token",
      email: "alex@example.com",
      fullName: {
        givenName: "Alex",
        familyName: "Appleseed",
        nickname: null,
      },
    })),
  };

  const AppleButton = Object.assign(jest.fn(() => null), {
    Style: {
      BLACK: "BLACK",
    },
    Type: {
      CONTINUE: "CONTINUE",
    },
  });

  return {
    __esModule: true,
    default: appleAuth,
    AppleButton,
  };
});
