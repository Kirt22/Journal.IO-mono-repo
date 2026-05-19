package com.journalfrontend

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.review.ReviewManagerFactory

class AppRatingModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppRatingModule"

  @ReactMethod
  fun requestReview(promise: Promise) {
    val activity = currentActivity

    if (activity == null) {
      promise.resolve(false)
      return
    }

    val manager = ReviewManagerFactory.create(reactContext)
    val request = manager.requestReviewFlow()

    request.addOnCompleteListener { requestTask ->
      if (!requestTask.isSuccessful) {
        promise.reject(
            "APP_REVIEW_UNAVAILABLE",
            requestTask.exception ?: RuntimeException("Review flow is unavailable")
        )
        return@addOnCompleteListener
      }

      val reviewInfo = requestTask.result
      manager.launchReviewFlow(activity, reviewInfo).addOnCompleteListener { launchTask ->
        if (launchTask.isSuccessful) {
          promise.resolve(true)
        } else {
          promise.reject(
              "APP_REVIEW_FAILED",
              launchTask.exception ?: RuntimeException("Review flow failed")
          )
        }
      }
    }
  }
}
