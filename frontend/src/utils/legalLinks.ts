import { Linking } from "react-native";
import { useAppStore } from "../store/appStore";

const LEGAL_BASE_URL = "https://api.journalio.app";
const SUPPORT_EMAIL = "support@journalio.app";

const LEGAL_URLS = {
  privacyPolicy: `${LEGAL_BASE_URL}/privacy`,
  termsOfService: `${LEGAL_BASE_URL}/terms`,
  privacyChoices: `${LEGAL_BASE_URL}/privacy-choices`,
  accountDeletion: `${LEGAL_BASE_URL}/account-deletion`,
  supportEmail: `mailto:${SUPPORT_EMAIL}`,
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

export { LEGAL_URLS, LEGAL_BASE_URL, SUPPORT_EMAIL, openExternalUrl };
