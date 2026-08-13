import Foundation
import React
import WidgetKit

@objc(WidgetBridge)
final class WidgetBridge: RCTEventEmitter {
  private static let deepLinkEventName = "widgetDeepLink"
  private static let deepLinkNotification = Notification.Name(
    "JournalWidgetDeepLinkReceived"
  )
  private static let pendingDeepLinkLock = NSLock()
  private static var pendingWidgetDeepLink: String?
  private static let supportedWidgetKinds = Set([
    JournalWidgetConstants.quickThoughtKind,
    JournalWidgetConstants.moodKind,
    JournalWidgetConstants.streakKind,
  ])

  @objc override static func requiresMainQueueSetup() -> Bool { false }

  override func supportedEvents() -> [String]! {
    [Self.deepLinkEventName]
  }

  override func startObserving() {
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(handleWidgetDeepLinkNotification(_:)),
      name: Self.deepLinkNotification,
      object: nil
    )
  }

  override func stopObserving() {
    NotificationCenter.default.removeObserver(
      self,
      name: Self.deepLinkNotification,
      object: nil
    )
  }

  /// Records a widget deep link and notifies JS.
  ///
  /// Returns `true` when the URL was a widget link and has been taken over by this
  /// bridge. Callers must not forward such URLs to `RCTLinkingManager` as well, or the
  /// action is queued twice (once from the emitter, once from `Linking`).
  @discardableResult
  static func recordPendingWidgetDeepLink(_ url: URL) -> Bool {
    guard url.scheme?.lowercased() == "journalio",
          url.host?.lowercased() == "widget" else {
      return false
    }

    pendingDeepLinkLock.lock()
    pendingWidgetDeepLink = url.absoluteString
    pendingDeepLinkLock.unlock()

#if DEBUG
    print("[WidgetDeepLink] recorded \(url.absoluteString)")
#endif

    NotificationCenter.default.post(
      name: deepLinkNotification,
      object: nil,
      userInfo: ["url": url.absoluteString]
    )

    return true
  }

  @objc private func handleWidgetDeepLinkNotification(
    _ notification: Notification
  ) {
    guard let url = notification.userInfo?["url"] as? String else {
      return
    }

#if DEBUG
    print("[WidgetDeepLink] emitted \(url)")
#endif
    sendEvent(withName: Self.deepLinkEventName, body: ["url": url])
  }

  @objc(consumePendingWidgetDeepLink:rejecter:)
  func consumePendingWidgetDeepLink(
    resolve: @escaping RCTPromiseResolveBlock,
    reject _: @escaping RCTPromiseRejectBlock
  ) {
    Self.pendingDeepLinkLock.lock()
    let url = Self.pendingWidgetDeepLink
    Self.pendingWidgetDeepLink = nil
    Self.pendingDeepLinkLock.unlock()
#if DEBUG
    print("[WidgetDeepLink] consumed \(url ?? "nil")")
#endif
    resolve(url ?? NSNull())
  }

  @objc(getOrCreateInstallationId:rejecter:)
  func getOrCreateInstallationId(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      resolve(try JournalWidgetStore().getOrCreateInstallationID())
    } catch {
      reject("E_WIDGET_STORAGE", error.localizedDescription, error)
    }
  }

  @objc(getInstalledWidgetKinds:rejecter:)
  func getInstalledWidgetKinds(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    WidgetCenter.shared.getCurrentConfigurations { result in
      switch result {
      case .success(let configurations):
        resolve(Array(Set(configurations.map(\.kind))).sorted())
      case .failure(let error):
        reject("E_WIDGET_CONFIGURATIONS", error.localizedDescription, error)
      }
    }
  }

  @objc(getWidgetStatus:rejecter:)
  func getWidgetStatus(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let store = try JournalWidgetStore()
      let configuration = store.loadConfiguration()
      let snapshot = store.effectiveSnapshot()
      let preferences = store.loadPreferences()
      let hasToken = configuration.flatMap {
        try? JournalWidgetKeychain.readToken(
          sessionGeneration: $0.sessionGeneration
        )
      } != nil
      let hasConfiguredSession = configuration != nil
        && hasToken
        && snapshot.authState == .ready
      let expiresAt: Any = configuration
        .map { Self.isoString(from: $0.tokenExpiresAt) }
        ?? NSNull()

      WidgetCenter.shared.getCurrentConfigurations { result in
        switch result {
        case .success(let configurations):
          resolve([
            "isAvailable": true,
            "installedKinds": Array(Set(configurations.map(\.kind))).sorted(),
            "hasConfiguredSession": hasConfiguredSession,
            "authState": snapshot.authState.rawValue,
            "hasCheckedInToday": snapshot.hasCheckedInToday,
            "lastActionStatus": snapshot.lastActionStatus.bridgeValue,
            "sessionGeneration": snapshot.sessionGeneration,
            "expiresAt": expiresAt,
            "isInitialized": preferences.isInitialized,
            "enabledKinds": preferences.enabledKinds,
            "hasPremiumAccess": preferences.hasPremiumAccess,
          ])
        case .failure(let error):
          reject("E_WIDGET_CONFIGURATIONS", error.localizedDescription, error)
        }
      }
    } catch {
      reject("E_WIDGET_STORAGE", error.localizedDescription, error)
    }
  }

  @objc(getWidgetPreferences:rejecter:)
  func getWidgetPreferences(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      resolve(Self.preferencesPayload(try JournalWidgetStore().loadPreferences()))
    } catch {
      reject("E_WIDGET_STORAGE", error.localizedDescription, error)
    }
  }

  @objc(updateWidgetPreferences:resolver:rejecter:)
  func updateWidgetPreferences(
    _ payload: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      guard let isInitialized = Self.boolean(payload["isInitialized"]),
            let hasPremiumAccess = Self.boolean(payload["hasPremiumAccess"]),
            let enabledKinds = Self.stringArray(payload["enabledKinds"]),
            enabledKinds.allSatisfy(Self.supportedWidgetKinds.contains) else {
        throw BridgeError.invalidPreferences
      }

      let preferences = JournalWidgetPreferences(
        schemaVersion: JournalWidgetConstants.schemaVersion,
        isInitialized: isInitialized,
        enabledKinds: Array(Set(enabledKinds)).sorted(),
        hasPremiumAccess: hasPremiumAccess,
        updatedAt: Date()
      )
      try JournalWidgetStore().savePreferences(preferences)
      Self.refreshWidgetGallery()
      resolve(Self.preferencesPayload(preferences))
    } catch {
      reject("E_WIDGET_PREFERENCES", error.localizedDescription, error)
    }
  }

  @objc(configureMoodSession:resolver:rejecter:)
  func configureMoodSession(
    _ payload: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      guard let widgetToken = Self.string(payload["widgetToken"]),
            !widgetToken.isEmpty,
            let expiresAt = Self.date(payload["expiresAt"]),
            expiresAt > Date(),
            let rawAPIBaseURL = Self.string(payload["apiBaseUrl"]),
            let requestedGeneration = Self.integer(payload["sessionGeneration"]),
            requestedGeneration >= 0 else {
        throw BridgeError.invalidConfiguration
      }

      let apiBaseURL = try JournalWidgetURLValidator.normalizedAPIBaseURL(
        from: rawAPIBaseURL
      )
      let store = try JournalWidgetStore()
      let installationID = store.getOrCreateInstallationID()
      let now = Date()
      let previousGeneration = store.loadConfiguration()?.sessionGeneration
      let sessionGeneration = max(
        requestedGeneration,
        (previousGeneration ?? -1) + 1,
        store.loadSnapshot().sessionGeneration + 1
      )
      let moodDateKey = Self.optionalString(payload["moodDateKey"])
      let selectedMood = try Self.optionalMood(payload["selectedMood"])
      let hasCheckedInToday = Self.boolean(payload["hasCheckedInToday"]) ?? false
      if let moodDateKey, !JournalWidgetStore.isValidMoodDateKey(moodDateKey) {
        throw BridgeError.invalidMoodDateKey
      }

      try JournalWidgetKeychain.saveToken(
        widgetToken,
        sessionGeneration: sessionGeneration
      )
      do {
        try store.saveConfiguration(
          JournalWidgetSessionConfiguration(
            schemaVersion: JournalWidgetConstants.schemaVersion,
            installationID: installationID,
            apiBaseURL: apiBaseURL.absoluteString,
            tokenExpiresAt: expiresAt,
            sessionGeneration: sessionGeneration,
            updatedAt: now
          )
        )
        try store.saveSnapshot(
          JournalWidgetSnapshot(
            schemaVersion: JournalWidgetConstants.schemaVersion,
            sessionGeneration: sessionGeneration,
            authState: .ready,
            moodDateKey: moodDateKey,
            selectedMood: selectedMood,
            hasCheckedInToday: hasCheckedInToday,
            lastActionStatus: hasCheckedInToday ? .saved : .idle,
            lastActionAt: hasCheckedInToday ? now : nil,
            updatedAt: now
          )
        )
        if let previousGeneration, previousGeneration != sessionGeneration {
          try? JournalWidgetKeychain.deleteToken(
            sessionGeneration: previousGeneration
          )
        }
        try? JournalWidgetKeychain.deleteLegacyToken()
      } catch {
        try? JournalWidgetKeychain.deleteToken(
          sessionGeneration: sessionGeneration
        )
        store.removeConfiguration()
        throw error
      }

      WidgetCenter.shared.reloadTimelines(ofKind: JournalWidgetConstants.moodKind)
      resolve(true)
    } catch {
      reject("E_WIDGET_CONFIGURATION", error.localizedDescription, error)
    }
  }

  @objc(updateMoodSnapshot:resolver:rejecter:)
  func updateMoodSnapshot(
    _ payload: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      guard let hasCheckedInToday = Self.boolean(payload["hasCheckedInToday"]) else {
        throw BridgeError.invalidSnapshot
      }
      let store = try JournalWidgetStore()
      var snapshot = store.loadSnapshot()
      let moodDateKey = Self.optionalString(payload["moodDateKey"])
      let selectedMood = try Self.optionalMood(payload["selectedMood"])
      if let moodDateKey, !JournalWidgetStore.isValidMoodDateKey(moodDateKey) {
        throw BridgeError.invalidMoodDateKey
      }

      if let rawAuthState = Self.string(payload["authState"]),
         let authState = JournalWidgetAuthState(rawValue: rawAuthState) {
        snapshot.authState = authState
      } else if payload["authState"] != nil && !(payload["authState"] is NSNull) {
        throw BridgeError.invalidSnapshot
      }

      if let rawActionStatus = Self.string(payload["lastActionStatus"]),
         let actionStatus = JournalWidgetActionStatus(bridgeValue: rawActionStatus) {
        snapshot.lastActionStatus = actionStatus
      } else if payload["lastActionStatus"] != nil
        && !(payload["lastActionStatus"] is NSNull) {
        throw BridgeError.invalidSnapshot
      } else {
        snapshot.lastActionStatus = hasCheckedInToday ? .saved : .idle
      }

      let now = Date()
      snapshot.schemaVersion = JournalWidgetConstants.schemaVersion
      snapshot.moodDateKey = moodDateKey
      snapshot.selectedMood = hasCheckedInToday ? selectedMood : nil
      snapshot.hasCheckedInToday = hasCheckedInToday
      snapshot.lastActionAt = snapshot.lastActionStatus == .idle ? nil : now
      snapshot.updatedAt = now
      if let generation = store.loadConfiguration()?.sessionGeneration {
        snapshot.sessionGeneration = generation
      }

      try store.saveSnapshot(snapshot)
      WidgetCenter.shared.reloadTimelines(ofKind: JournalWidgetConstants.moodKind)
      resolve(true)
    } catch {
      reject("E_WIDGET_SNAPSHOT", error.localizedDescription, error)
    }
  }

  @objc(updateStreakSnapshot:resolver:rejecter:)
  func updateStreakSnapshot(
    _ payload: NSDictionary,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      guard let currentStreak = Self.nonNegativeInteger(payload["currentStreak"]),
            let bestStreak = Self.nonNegativeInteger(payload["bestStreak"]),
            let thisMonthEntries = Self.nonNegativeInteger(payload["thisMonthEntries"]),
            let totalEntries = Self.nonNegativeInteger(payload["totalEntries"]),
            let hasEntryToday = Self.boolean(payload["hasEntryToday"]) else {
        throw BridgeError.invalidStreakSnapshot
      }

      let lastEntryDateKey = Self.optionalString(payload["lastEntryDateKey"])
      let activity30Days = Self.booleanArray(payload["activity30Days"])
      if let lastEntryDateKey,
         !JournalWidgetStore.isValidMoodDateKey(lastEntryDateKey) {
        throw BridgeError.invalidStreakSnapshot
      }
      if payload["activity30Days"] != nil,
         !(payload["activity30Days"] is NSNull),
         activity30Days?.count != 30 {
        throw BridgeError.invalidStreakSnapshot
      }

      var authState = JournalWidgetAuthState.ready
      if let rawAuthState = Self.string(payload["authState"]) {
        guard let parsed = JournalWidgetAuthState(rawValue: rawAuthState) else {
          throw BridgeError.invalidStreakSnapshot
        }
        authState = parsed
      } else if payload["authState"] != nil && !(payload["authState"] is NSNull) {
        throw BridgeError.invalidStreakSnapshot
      }

      let store = try JournalWidgetStore()
      try store.saveStreakSnapshot(
        JournalWidgetStreakSnapshot(
          schemaVersion: JournalWidgetConstants.schemaVersion,
          authState: authState,
          currentStreak: currentStreak,
          bestStreak: bestStreak,
          thisMonthEntries: thisMonthEntries,
          totalEntries: totalEntries,
          hasEntryToday: hasEntryToday,
          lastEntryDateKey: lastEntryDateKey,
          activity30Days: activity30Days,
          updatedAt: Date()
        )
      )
      WidgetCenter.shared.reloadTimelines(ofKind: JournalWidgetConstants.streakKind)
      resolve(true)
    } catch {
      reject("E_WIDGET_STREAK_SNAPSHOT", error.localizedDescription, error)
    }
  }

  @objc(reloadWidgets:resolver:rejecter:)
  func reloadWidgets(
    _ kind: String?,
    resolve: @escaping RCTPromiseResolveBlock,
    reject _: @escaping RCTPromiseRejectBlock
  ) {
    if let kind, !kind.isEmpty {
      WidgetCenter.shared.reloadTimelines(ofKind: kind)
    } else {
      Self.refreshWidgetGallery()
    }
    resolve(true)
  }

  @objc(clearMoodSession:rejecter:)
  func clearMoodSession(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let store = try JournalWidgetStore()
      let nextGeneration = max(
        store.loadConfiguration()?.sessionGeneration ?? 0,
        store.loadSnapshot().sessionGeneration
      ) + 1
      try JournalWidgetKeychain.deleteAllTokens()
      store.removeConfiguration()
      try store.saveSnapshot(.signedOut(sessionGeneration: nextGeneration))
      WidgetCenter.shared.reloadTimelines(ofKind: JournalWidgetConstants.moodKind)
      resolve(true)
    } catch {
      reject("E_WIDGET_CLEAR", error.localizedDescription, error)
    }
  }

  @objc(clearSession:rejecter:)
  func clearSession(
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    do {
      let store = try JournalWidgetStore()
      let nextGeneration = max(
        store.loadConfiguration()?.sessionGeneration ?? 0,
        store.loadSnapshot().sessionGeneration
      ) + 1
      try JournalWidgetKeychain.deleteAllTokens()
      store.removeConfiguration()
      store.removePreferences()
      store.removeInstallationID()
      try store.saveSnapshot(.signedOut(sessionGeneration: nextGeneration))
      try? store.saveStreakSnapshot(.signedOut())
      Self.refreshWidgetGallery()
      resolve(true)
    } catch {
      reject("E_WIDGET_CLEAR", error.localizedDescription, error)
    }
  }

  private enum BridgeError: LocalizedError {
    case invalidConfiguration
    case invalidMoodDateKey
    case invalidSnapshot
    case invalidStreakSnapshot
    case invalidPreferences

    var errorDescription: String? {
      switch self {
      case .invalidConfiguration: return "The widget session configuration is invalid."
      case .invalidMoodDateKey: return "The widget mood date is invalid."
      case .invalidSnapshot: return "The widget mood snapshot is invalid."
      case .invalidStreakSnapshot: return "The widget streak snapshot is invalid."
      case .invalidPreferences: return "The widget preferences are invalid."
      }
    }
  }

  private static func string(_ value: Any?) -> String? {
    (value as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  private static func optionalString(_ value: Any?) -> String? {
    guard !(value is NSNull) else { return nil }
    return string(value)
  }

  private static func integer(_ value: Any?) -> Int? {
    (value as? NSNumber)?.intValue
  }

  private static func nonNegativeInteger(_ value: Any?) -> Int? {
    guard let intValue = integer(value), intValue >= 0 else { return nil }
    return intValue
  }

  private static func boolean(_ value: Any?) -> Bool? {
    (value as? NSNumber)?.boolValue
  }

  private static func stringArray(_ value: Any?) -> [String]? {
    guard let values = value as? [Any] else { return nil }
    let strings = values.compactMap(Self.string)
    return strings.count == values.count ? strings : nil
  }

  private static func booleanArray(_ value: Any?) -> [Bool]? {
    guard !(value is NSNull) else { return nil }
    guard let values = value as? [Any] else { return nil }
    let booleans = values.compactMap(Self.boolean)
    return booleans.count == values.count ? booleans : nil
  }

  private static func optionalMood(_ value: Any?) throws -> JournalWidgetMood? {
    guard !(value is NSNull), value != nil else { return nil }
    guard let rawValue = string(value),
          let mood = JournalWidgetMood(rawValue: rawValue) else {
      throw BridgeError.invalidSnapshot
    }
    return mood
  }

  private static func preferencesPayload(
    _ preferences: JournalWidgetPreferences
  ) -> [String: Any] {
    [
      "isInitialized": preferences.isInitialized,
      "enabledKinds": preferences.enabledKinds,
      "hasPremiumAccess": preferences.hasPremiumAccess,
      "updatedAt": isoString(from: preferences.updatedAt),
    ]
  }

  private static func refreshWidgetGallery() {
    if #available(iOS 16.0, *) {
      WidgetCenter.shared.invalidateConfigurationRecommendations()
    }
    WidgetCenter.shared.reloadAllTimelines()
  }

  private static func date(_ value: Any?) -> Date? {
    if let number = value as? NSNumber {
      let rawValue = number.doubleValue
      let seconds = rawValue > 10_000_000_000 ? rawValue / 1_000 : rawValue
      return Date(timeIntervalSince1970: seconds)
    }
    guard let value = string(value) else { return nil }
    let fractionalFormatter = ISO8601DateFormatter()
    fractionalFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return fractionalFormatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
  }

  private static func isoString(from date: Date) -> String {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.string(from: date)
  }
}
