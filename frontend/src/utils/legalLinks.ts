import { Linking } from "react-native";
import { useAppStore } from "../store/appStore";

const LEGAL_BASE_URL = "https://api.journalio.app";
// Capture the native handler before App routes web links into the in-app browser.
const openNativeUrl = Linking.openURL.bind(Linking);

const LEGAL_URLS = {
  privacyPolicy: `${LEGAL_BASE_URL}/privacy`,
  termsOfService: `${LEGAL_BASE_URL}/terms`,
  usagePolicy: `${LEGAL_BASE_URL}/acceptable-use`,
  privacyChoices: `${LEGAL_BASE_URL}/privacy-choices`,
  accountDeletion: `${LEGAL_BASE_URL}/account-deletion`,
  supportPage: `${LEGAL_BASE_URL}/support`,
} as const;

const openExternalUrl = async (url: string, title?: string | null) => {
  if (/^https?:\/\//i.test(url)) {
    useAppStore.getState().openLegalBrowser({
      url,
      title: title || null,
    });
    return;
  }

  await Linking.openURL(url);
};

const openDeviceBrowserUrl = async (url: string) => {
  await openNativeUrl(url);
};

export { LEGAL_URLS, LEGAL_BASE_URL, openDeviceBrowserUrl, openExternalUrl };
