import { resetAppStore, useAppStore } from '../src/store/appStore';
import { triggerHaptic } from '../src/services/hapticsService';

const mockSelection = jest.fn();
const mockImpactHeavy = jest.fn();
const mockImpactSoft = jest.fn();
const mockEnableSound = jest.fn();
let now = 10_000;

jest.mock('react-native-pulsar', () => ({
  Presets: {
    System: {
      impactHeavy: mockImpactHeavy,
      impactSoft: mockImpactSoft,
      selection: mockSelection,
    },
  },
  Settings: {
    enableSound: mockEnableSound,
  },
}));

describe('hapticsService', () => {
  beforeAll(() => {
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });

  beforeEach(() => {
    resetAppStore();
    jest.clearAllMocks();
    now += 10_000;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('maps auth entrance events to distinct system feedback strengths', async () => {
    await triggerHaptic('optionSelected');

    expect(mockSelection).toHaveBeenCalledTimes(1);
    expect(mockEnableSound).toHaveBeenCalledWith(false);

    now += 220;
    await triggerHaptic('authIntroProgress');
    now += 220;
    await triggerHaptic('authIntroMerge');
    now += 220;
    await triggerHaptic('authIntroWelcome');
    now += 220;
    await triggerHaptic('authIntroReveal');

    expect(mockImpactSoft).toHaveBeenCalledTimes(2);
    expect(mockImpactHeavy).toHaveBeenCalledTimes(1);
    expect(mockSelection).toHaveBeenCalledTimes(2);
  });

  it('allows a 120ms reveal cadence without weakening the global throttle', async () => {
    await triggerHaptic('authIntroReveal');
    now += 119;
    await triggerHaptic('authIntroReveal');
    now += 1;
    await triggerHaptic('authIntroReveal');

    expect(mockSelection).toHaveBeenCalledTimes(2);

    now += 219;
    await triggerHaptic('optionSelected');
    expect(mockSelection).toHaveBeenCalledTimes(2);

    now += 1;
    await triggerHaptic('optionSelected');
    expect(mockSelection).toHaveBeenCalledTimes(3);
  });

  it('does not invoke the native haptics module when disabled', async () => {
    useAppStore.setState({ hapticsEnabled: false });

    await triggerHaptic('authIntroProgress');
    await triggerHaptic('authIntroMerge');
    await triggerHaptic('authIntroReveal');

    expect(mockImpactSoft).not.toHaveBeenCalled();
    expect(mockImpactHeavy).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });
});
