/**
 * Bundled screen recording that shows how to add a Journal.IO widget to the iOS
 * Home Screen, played inside the phone frame in `components/AddWidgetDemoPhone`
 * — the onboarding widget step and the Settings > Widgets sheet both use it.
 *
 * The clip is a 37 s capture transcoded to a muted, loop-friendly H.264 MP4 at
 * 640x1392 (~5.4 MB) — roughly 3x the phone frame it renders in, so it stays
 * sharp without carrying the full-resolution recording into the app bundle.
 *
 * The cast is because Metro resolves an asset `require` to a number while
 * react-native-video types the field as `NodeRequire`. Setting this back to
 * `null` is a supported state: the phone frame then falls back to the written
 * `ADD_WIDGET_STEPS`, the same fallback that covers a codec failure.
 */
const ADD_WIDGET_DEMO_VIDEO: NodeRequire | null =
  require('./add-widget-demo.mp4') as unknown as NodeRequire;

export { ADD_WIDGET_DEMO_VIDEO };
