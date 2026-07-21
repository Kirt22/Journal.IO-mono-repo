#import <React/RCTViewManager.h>

@interface RCT_EXTERN_REMAP_MODULE(JournalMindMapView, JournalMindMapViewManager, RCTViewManager)

RCT_EXPORT_VIEW_PROPERTY(regions, NSArray)
RCT_EXPORT_VIEW_PROPERTY(selectedRegionId, NSString)
RCT_EXPORT_VIEW_PROPERTY(graphPalette, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(themeMode, NSString)
RCT_EXPORT_VIEW_PROPERTY(cameraResetToken, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(reduceMotionEnabled, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onRegionPress, RCTDirectEventBlock)

@end
