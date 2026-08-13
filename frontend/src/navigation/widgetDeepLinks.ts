import type { MoodValue } from '../services/moodService';

const WIDGET_SCHEME_PREFIX = 'journalio://widget/';
const MOOD_VALUES = new Set<MoodValue>([
  'amazing',
  'good',
  'okay',
  'bad',
  'terrible',
]);

type WidgetDeepLinkAction =
  | { type: 'quick-thought' }
  | { type: 'home' }
  | { type: 'streaks' }
  | { type: 'widget-settings' }
  | { type: 'open-mood' }
  | { type: 'mood'; mood: MoodValue };

type UrlSubscription = { remove: () => void };
type AddUrlListener = (
  listener: (event: { url: string }) => void,
) => UrlSubscription;
type ConsumePendingUrl = () => Promise<string | null>;

const isWidgetDeepLink = (url: string) =>
  url.startsWith(WIDGET_SCHEME_PREFIX);

const parseWidgetDeepLink = (url: string): WidgetDeepLinkAction | null => {
  if (!isWidgetDeepLink(url)) {
    return null;
  }

  if (url === `${WIDGET_SCHEME_PREFIX}quick-thought`) {
    return { type: 'quick-thought' };
  }

  if (url === `${WIDGET_SCHEME_PREFIX}home`) {
    return { type: 'home' };
  }

  if (url === `${WIDGET_SCHEME_PREFIX}streaks`) {
    return { type: 'streaks' };
  }

  if (url === `${WIDGET_SCHEME_PREFIX}settings`) {
    return { type: 'widget-settings' };
  }

  const moodUrl = `${WIDGET_SCHEME_PREFIX}mood`;

  if (url === moodUrl) {
    return { type: 'open-mood' };
  }

  if (!url.startsWith(`${moodUrl}?value=`)) {
    return null;
  }

  const mood = url.slice(`${moodUrl}?value=`.length);

  if (!MOOD_VALUES.has(mood as MoodValue)) {
    return null;
  }

  return { type: 'mood', mood: mood as MoodValue };
};

const consumeWidgetDeepLink = (
  url: string,
  queueAction: (action: WidgetDeepLinkAction) => void,
) => {
  if (!isWidgetDeepLink(url)) {
    return false;
  }

  const action = parseWidgetDeepLink(url);

  if (action) {
    queueAction(action);
  }

  // Invalid widget URLs are still consumed so they cannot become navigation routes.
  return true;
};

const resolveWidgetAwareInitialUrl = async (
  getInitialUrl: () => Promise<string | null>,
  queueAction: (action: WidgetDeepLinkAction) => void,
  consumePendingUrl: ConsumePendingUrl = async () => null,
) => {
  const initialUrl = await getInitialUrl();
  const pendingWidgetUrl = await consumePendingUrl();
  const url = initialUrl ?? pendingWidgetUrl;

  if (!url || !consumeWidgetDeepLink(url, queueAction)) {
    return url;
  }

  return null;
};

const subscribeToWidgetAwareUrls = (
  addUrlListener: AddUrlListener,
  navigationListener: (url: string) => void,
  queueAction: (action: WidgetDeepLinkAction) => void,
  consumePendingUrl: ConsumePendingUrl = async () => null,
) => {
  const handleUrl = (url: string) => {
    consumePendingUrl().catch(() => undefined);

    if (!consumeWidgetDeepLink(url, queueAction)) {
      navigationListener(url);
    }
  };
  const subscription = addUrlListener(({ url }) => handleUrl(url));

  consumePendingUrl()
    .then(url => {
      if (url) {
        handleUrl(url);
      }
    })
    .catch(() => undefined);

  return subscription;
};

export {
  consumeWidgetDeepLink,
  isWidgetDeepLink,
  parseWidgetDeepLink,
  resolveWidgetAwareInitialUrl,
  subscribeToWidgetAwareUrls,
};
export type { AddUrlListener, ConsumePendingUrl, WidgetDeepLinkAction };
