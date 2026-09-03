import Share from 'react-native-share';
import { releaseCapture } from 'react-native-view-shot';
import { shareMindMapImage } from '../src/services/mindMapShareService';

test('shares a PNG through the native sheet and releases the temporary capture', async () => {
  (Share.open as jest.Mock).mockResolvedValueOnce({
    dismissedAction: true,
    message: 'dismissed',
    success: false,
  });

  await expect(
    shareMindMapImage('/tmp/mind-map.png'),
  ).resolves.toBe('dismissed');

  // `urls` is the key the iOS module actually reads.
  expect(Share.open).toHaveBeenCalledWith(
    expect.objectContaining({
      failOnCancel: false,
      saveToFiles: false,
      type: 'image/png',
      urls: ['file:///tmp/mind-map.png'],
    }),
  );
  expect(Share.open).not.toHaveBeenCalledWith(
    expect.objectContaining({ useInternalStorage: expect.anything() }),
  );
  expect(releaseCapture).toHaveBeenCalledWith('/tmp/mind-map.png');
});

test('releases the capture when the native share sheet fails', async () => {
  (Share.open as jest.Mock).mockRejectedValueOnce(new Error('share failed'));

  await expect(shareMindMapImage('file:///tmp/mind-map.png')).rejects.toThrow(
    'share failed',
  );
  expect(releaseCapture).toHaveBeenCalledWith('file:///tmp/mind-map.png');
});
