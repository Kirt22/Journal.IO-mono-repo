import Foundation
import React
import StoreKit
import UIKit

@objc(AppRatingModule)
class AppRatingModule: NSObject {
  @objc
  static func requiresMainQueueSetup() -> Bool {
    true
  }

  @objc(requestReview:rejecter:)
  func requestReview(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      if #available(iOS 14.0, *) {
        guard let scene = UIApplication.shared.connectedScenes
          .compactMap({ $0 as? UIWindowScene })
          .first(where: { $0.activationState == .foregroundActive }) else {
            resolve(false)
            return
          }

        SKStoreReviewController.requestReview(in: scene)
        resolve(true)
        return
      }

      SKStoreReviewController.requestReview()
      resolve(true)
    }
  }
}
