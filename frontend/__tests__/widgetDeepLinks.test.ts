import {
  consumeWidgetDeepLink,
  parseWidgetDeepLink,
  resolveWidgetAwareInitialUrl,
  subscribeToWidgetAwareUrls,
  type WidgetDeepLinkAction,
} from '../src/navigation/widgetDeepLinks';

describe('widget deep links', () => {
  it.each([
    ['journalio://widget/quick-thought', { type: 'quick-thought' }],
    ['journalio://widget/home', { type: 'home' }],
    ['journalio://widget/streaks', { type: 'streaks' }],
    ['journalio://widget/settings', { type: 'widget-settings' }],
    ['journalio://widget/mood', { type: 'open-mood' }],
    [
      'journalio://widget/mood?value=amazing',
      { type: 'mood', mood: 'amazing' },
    ],
    ['journalio://widget/mood?value=good', { type: 'mood', mood: 'good' }],
    ['journalio://widget/mood?value=okay', { type: 'mood', mood: 'okay' }],
    ['journalio://widget/mood?value=bad', { type: 'mood', mood: 'bad' }],
    [
      'journalio://widget/mood?value=terrible',
      { type: 'mood', mood: 'terrible' },
    ],
  ])('parses the supported URL %s', (url, expected) => {
    expect(parseWidgetDeepLink(url)).toEqual(expected);
  });

  it.each([
    'journalio://widget/quick-thought/',
    'journalio://widget/quick-thought?value=good',
    'journalio://widget/mood/',
    'journalio://widget/mood?value=great',
    'journalio://widget/mood?value=good&value=bad',
    'journalio://widget/mood?value=good&source=test',
    'journalio://widget/mood#good',
    'journalio://widget/unknown',
    'https://widget/mood?value=good',
    'journalio://reset-password?token=secret',
  ])('rejects unsupported or ambiguous URL %s', url => {
    expect(parseWidgetDeepLink(url)).toBeNull();
  });

  it('queues a cold-start widget action without passing it to navigation', async () => {
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();

    await expect(
      resolveWidgetAwareInitialUrl(
        async () => 'journalio://widget/quick-thought',
        queueAction,
      ),
    ).resolves.toBeNull();
    expect(queueAction).toHaveBeenCalledWith({ type: 'quick-thought' });
  });

  it('falls back to the pending native widget URL on cold start', async () => {
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();
    const consumePendingUrl = jest.fn(
      async () => 'journalio://widget/quick-thought',
    );

    await expect(
      resolveWidgetAwareInitialUrl(
        async () => null,
        queueAction,
        consumePendingUrl,
      ),
    ).resolves.toBeNull();

    expect(consumePendingUrl).toHaveBeenCalledTimes(1);
    expect(queueAction).toHaveBeenCalledWith({ type: 'quick-thought' });
  });

  it('drains the native fallback when React Native supplies the initial URL', async () => {
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();
    const consumePendingUrl = jest.fn(
      async () => 'journalio://widget/quick-thought',
    );

    await resolveWidgetAwareInitialUrl(
      async () => 'journalio://widget/quick-thought',
      queueAction,
      consumePendingUrl,
    );

    expect(consumePendingUrl).toHaveBeenCalledTimes(1);
    expect(queueAction).toHaveBeenCalledTimes(1);
  });

  it('preserves reset-password and other non-widget initial URLs', async () => {
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();
    const resetUrl = 'journalio://reset-password?token=reset-token';

    await expect(
      resolveWidgetAwareInitialUrl(async () => resetUrl, queueAction),
    ).resolves.toBe(resetUrl);
    expect(queueAction).not.toHaveBeenCalled();
  });

  it('filters warm widget URLs while forwarding ordinary navigation URLs', () => {
    const listenerRef: {
      current?: (event: { url: string }) => void;
    } = {};
    const remove = jest.fn();
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();
    const navigationListener = jest.fn();

    const subscription = subscribeToWidgetAwareUrls(
      listener => {
        listenerRef.current = listener;
        return { remove };
      },
      navigationListener,
      queueAction,
    );

    listenerRef.current?.({ url: 'journalio://widget/mood?value=okay' });
    listenerRef.current?.({
      url: 'journalio://reset-password?token=reset-token',
    });

    expect(queueAction).toHaveBeenCalledWith({ type: 'mood', mood: 'okay' });
    expect(navigationListener).toHaveBeenCalledTimes(1);
    expect(navigationListener).toHaveBeenCalledWith(
      'journalio://reset-password?token=reset-token',
    );

    subscription.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('drains the native fallback after a warm widget URL', async () => {
    const listenerRef: {
      current?: (event: { url: string }) => void;
    } = {};
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();
    const consumePendingUrl = jest.fn(async () => null);

    subscribeToWidgetAwareUrls(
      listener => {
        listenerRef.current = listener;
        return { remove: jest.fn() };
      },
      jest.fn(),
      queueAction,
      consumePendingUrl,
    );

    await Promise.resolve();
    consumePendingUrl.mockClear();

    listenerRef.current?.({ url: 'journalio://widget/quick-thought' });
    await Promise.resolve();

    expect(consumePendingUrl).toHaveBeenCalledTimes(1);
    expect(queueAction).toHaveBeenCalledWith({ type: 'quick-thought' });
  });

  it('drains a widget URL delivered between initial resolution and subscription', async () => {
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();
    const consumePendingUrl = jest
      .fn<Promise<string | null>, []>()
      .mockResolvedValueOnce('journalio://widget/quick-thought')
      .mockResolvedValue(null);

    subscribeToWidgetAwareUrls(
      () => ({ remove: jest.fn() }),
      jest.fn(),
      queueAction,
      consumePendingUrl,
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(queueAction).toHaveBeenCalledWith({ type: 'quick-thought' });
  });

  it('consumes malformed widget URLs without queuing or navigating them', () => {
    const queueAction = jest.fn<void, [WidgetDeepLinkAction]>();

    expect(
      consumeWidgetDeepLink(
        'journalio://widget/mood?value=good&source=untrusted',
        queueAction,
      ),
    ).toBe(true);
    expect(queueAction).not.toHaveBeenCalled();
  });
});
