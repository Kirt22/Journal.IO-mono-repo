import Foundation
import Security

enum JournalWidgetConstants {
  static let appGroupIdentifier = "group.app.journalio.widgets"
  static let keychainService = "journalio.widget.session"
  static let keychainAccountPrefix = "mood-widget-token"
  static let keychainAccessGroupInfoKey = "JournalIOWidgetKeychainAccessGroup"
  static let productionAPIHostInfoKey = "JournalIOWidgetProductionAPIHost"
  static let quickThoughtKind = "JournalQuickThoughtWidget"
  static let moodKind = "JournalMoodWidget"
  static let streakKind = "JournalStreakWidget"
  static let schemaVersion = 1
}

enum JournalWidgetAuthState: String, Codable {
  case signedOut
  case ready
  case reconnectRequired
  case premiumRequired
}

enum JournalWidgetActionStatus: String, Codable {
  case idle
  case submitting
  case saved
  case retry

  init?(bridgeValue: String) {
    switch bridgeValue {
    case "idle": self = .idle
    case "submitting": self = .submitting
    case "saved": self = .saved
    case "failed", "retry": self = .retry
    default: return nil
    }
  }

  var bridgeValue: String {
    self == .retry ? "failed" : rawValue
  }
}

enum JournalWidgetMood: String, Codable, CaseIterable {
  case amazing
  case good
  case okay
  case bad
  case terrible
}

struct JournalWidgetSnapshot: Codable {
  var schemaVersion: Int
  var sessionGeneration: Int
  var authState: JournalWidgetAuthState
  var moodDateKey: String?
  var selectedMood: JournalWidgetMood?
  var hasCheckedInToday: Bool
  var lastActionStatus: JournalWidgetActionStatus
  var lastActionAt: Date?
  var updatedAt: Date

  static func signedOut(sessionGeneration: Int = 0, now: Date = Date()) -> Self {
    Self(
      schemaVersion: JournalWidgetConstants.schemaVersion,
      sessionGeneration: sessionGeneration,
      authState: .signedOut,
      moodDateKey: nil,
      selectedMood: nil,
      hasCheckedInToday: false,
      lastActionStatus: .idle,
      lastActionAt: nil,
      updatedAt: now
    )
  }
}

struct JournalWidgetStreakSnapshot: Codable {
  var schemaVersion: Int
  var authState: JournalWidgetAuthState
  var currentStreak: Int
  var bestStreak: Int
  var thisMonthEntries: Int
  var totalEntries: Int
  var hasEntryToday: Bool
  var lastEntryDateKey: String?
  var activity30Days: [Bool]?
  var updatedAt: Date

  static func signedOut(now: Date = Date()) -> Self {
    Self(
      schemaVersion: JournalWidgetConstants.schemaVersion,
      authState: .signedOut,
      currentStreak: 0,
      bestStreak: 0,
      thisMonthEntries: 0,
      totalEntries: 0,
      hasEntryToday: false,
      lastEntryDateKey: nil,
      activity30Days: nil,
      updatedAt: now
    )
  }
}

struct JournalWidgetPreferences: Codable {
  var schemaVersion: Int
  var isInitialized: Bool
  var enabledKinds: [String]
  var hasPremiumAccess: Bool
  var updatedAt: Date

  static func empty(now: Date = Date()) -> Self {
    Self(
      schemaVersion: JournalWidgetConstants.schemaVersion,
      isInitialized: false,
      enabledKinds: [],
      hasPremiumAccess: false,
      updatedAt: now
    )
  }

  func isEnabled(_ kind: String) -> Bool {
    enabledKinds.contains(kind)
  }
}

struct JournalWidgetSessionConfiguration: Codable {
  var schemaVersion: Int
  var installationID: String
  var apiBaseURL: String
  var tokenExpiresAt: Date
  var sessionGeneration: Int
  var updatedAt: Date
}

enum JournalWidgetSharedError: LocalizedError {
  case appGroupUnavailable
  case invalidAPIBaseURL
  case invalidKeychainAccessGroup
  case keychainFailure(OSStatus)

  var errorDescription: String? {
    switch self {
    case .appGroupUnavailable:
      return "The widget App Group is unavailable."
    case .invalidAPIBaseURL:
      return "The widget API URL is not allowed."
    case .invalidKeychainAccessGroup:
      return "The shared Keychain access group is unavailable."
    case .keychainFailure(let status):
      return "The shared Keychain operation failed (\(status))."
    }
  }
}

struct JournalWidgetStore {
  private enum Keys {
    static let installationID = "journalio.widget.installation-id"
    static let configuration = "journalio.widget.configuration.v1"
    static let snapshot = "journalio.widget.snapshot.v1"
    static let streakSnapshot = "journalio.widget.streak-snapshot.v1"
    static let preferences = "journalio.widget.preferences.v1"
  }

  private let defaults: UserDefaults
  private let encoder: JSONEncoder
  private let decoder: JSONDecoder

  init() throws {
    guard let defaults = UserDefaults(
      suiteName: JournalWidgetConstants.appGroupIdentifier
    ) else {
      throw JournalWidgetSharedError.appGroupUnavailable
    }

    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601

    self.defaults = defaults
    self.encoder = encoder
    self.decoder = decoder
  }

  func getOrCreateInstallationID() -> String {
    if let existing = defaults.string(forKey: Keys.installationID),
       UUID(uuidString: existing) != nil {
      return existing
    }

    let identifier = UUID().uuidString.lowercased()
    defaults.set(identifier, forKey: Keys.installationID)
    return identifier
  }

  func removeInstallationID() {
    defaults.removeObject(forKey: Keys.installationID)
  }

  func loadConfiguration() -> JournalWidgetSessionConfiguration? {
    guard let data = defaults.data(forKey: Keys.configuration),
          let configuration = try? decoder.decode(
            JournalWidgetSessionConfiguration.self,
            from: data
          ),
          configuration.schemaVersion == JournalWidgetConstants.schemaVersion else {
      return nil
    }

    return configuration
  }

  func saveConfiguration(_ configuration: JournalWidgetSessionConfiguration) throws {
    defaults.set(try encoder.encode(configuration), forKey: Keys.configuration)
  }

  func removeConfiguration() {
    defaults.removeObject(forKey: Keys.configuration)
  }

  func loadSnapshot() -> JournalWidgetSnapshot {
    guard let data = defaults.data(forKey: Keys.snapshot),
          let snapshot = try? decoder.decode(JournalWidgetSnapshot.self, from: data),
          snapshot.schemaVersion == JournalWidgetConstants.schemaVersion else {
      return .signedOut()
    }

    return snapshot
  }

  func saveSnapshot(_ snapshot: JournalWidgetSnapshot) throws {
    defaults.set(try encoder.encode(snapshot), forKey: Keys.snapshot)
  }

  func loadStreakSnapshot() -> JournalWidgetStreakSnapshot {
    guard let data = defaults.data(forKey: Keys.streakSnapshot),
          let snapshot = try? decoder.decode(
            JournalWidgetStreakSnapshot.self,
            from: data
          ),
          snapshot.schemaVersion == JournalWidgetConstants.schemaVersion else {
      return .signedOut()
    }

    return snapshot
  }

  func saveStreakSnapshot(_ snapshot: JournalWidgetStreakSnapshot) throws {
    defaults.set(try encoder.encode(snapshot), forKey: Keys.streakSnapshot)
  }

  func removeStreakSnapshot() {
    defaults.removeObject(forKey: Keys.streakSnapshot)
  }

  func loadPreferences() -> JournalWidgetPreferences {
    guard let data = defaults.data(forKey: Keys.preferences),
          let preferences = try? decoder.decode(
            JournalWidgetPreferences.self,
            from: data
          ),
          preferences.schemaVersion == JournalWidgetConstants.schemaVersion else {
      return .empty()
    }

    return preferences
  }

  func savePreferences(_ preferences: JournalWidgetPreferences) throws {
    defaults.set(try encoder.encode(preferences), forKey: Keys.preferences)
  }

  func removePreferences() {
    defaults.removeObject(forKey: Keys.preferences)
  }

  /// Streaks are computed by the backend in UTC calendar days. Across a day
  /// boundary the widget may render before the app has refreshed, so we
  /// self-correct here: a streak is only "alive" when the most recent entry
  /// falls on today's or yesterday's UTC day (matching `computeCurrentStreak`).
  func effectiveStreakSnapshot(at now: Date = Date()) -> JournalWidgetStreakSnapshot {
    var snapshot = loadStreakSnapshot()

    guard snapshot.authState == .ready else {
      return snapshot
    }

    let todayKey = Self.utcDateKey(for: now)
    let yesterdayKey = Self.utcDateKey(
      for: JournalWidgetStore.utcCalendar.date(byAdding: .day, value: -1, to: now)
        ?? now.addingTimeInterval(-86_400)
    )

    let hasEntryToday = snapshot.lastEntryDateKey == todayKey
    let isAlive = hasEntryToday || snapshot.lastEntryDateKey == yesterdayKey

    snapshot.hasEntryToday = hasEntryToday
    if !isAlive {
      snapshot.currentStreak = 0
    }

    return snapshot
  }

  private static let utcCalendar: Calendar = {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
    return calendar
  }()

  static func utcDateKey(for date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  func effectiveSnapshot(at now: Date = Date()) -> JournalWidgetSnapshot {
    var snapshot = loadSnapshot()
    let configuration = loadConfiguration()

    if snapshot.authState == .ready {
      guard let configuration else {
        snapshot.authState = .reconnectRequired
        snapshot.selectedMood = nil
        snapshot.hasCheckedInToday = false
        snapshot.lastActionStatus = .idle
        return snapshot
      }

      if configuration.tokenExpiresAt <= now {
        snapshot.authState = .reconnectRequired
        snapshot.selectedMood = nil
        snapshot.hasCheckedInToday = false
        snapshot.lastActionStatus = .idle
        return snapshot
      }
    }

    let todayKey = Self.moodDateKey(for: now)
    if snapshot.moodDateKey != todayKey {
      snapshot.selectedMood = nil
      snapshot.hasCheckedInToday = false
      if let lastActionAt = snapshot.lastActionAt,
         !Calendar.current.isDate(lastActionAt, inSameDayAs: now) {
        snapshot.lastActionStatus = .idle
        snapshot.lastActionAt = nil
      } else if snapshot.lastActionStatus == .saved {
        snapshot.lastActionStatus = .idle
      }
    }

    return snapshot
  }

  static func moodDateKey(for date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  static func isValidMoodDateKey(_ value: String) -> Bool {
    guard value.range(
      of: #"^\d{4}-\d{2}-\d{2}$"#,
      options: .regularExpression
    ) != nil else {
      return false
    }

    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(secondsFromGMT: 0)
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.isLenient = false
    return formatter.date(from: value) != nil
  }
}

enum JournalWidgetKeychain {
  static func readToken(sessionGeneration: Int) throws -> String? {
    var query = try tokenQuery(sessionGeneration: sessionGeneration)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &result)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess else {
      throw JournalWidgetSharedError.keychainFailure(status)
    }
    guard let data = result as? Data,
          let token = String(data: data, encoding: .utf8),
          !token.isEmpty else {
      return nil
    }
    return token
  }

  static func saveToken(_ token: String, sessionGeneration: Int) throws {
    let data = Data(token.utf8)
    var query = try tokenQuery(sessionGeneration: sessionGeneration)
    let update = [kSecValueData as String: data]
    let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
    if updateStatus == errSecSuccess { return }
    guard updateStatus == errSecItemNotFound else {
      throw JournalWidgetSharedError.keychainFailure(updateStatus)
    }

    query[kSecValueData as String] = data
    query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    let addStatus = SecItemAdd(query as CFDictionary, nil)
    guard addStatus == errSecSuccess else {
      throw JournalWidgetSharedError.keychainFailure(addStatus)
    }
  }

  static func deleteToken(sessionGeneration: Int) throws {
    let status = SecItemDelete(
      try tokenQuery(sessionGeneration: sessionGeneration) as CFDictionary
    )
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw JournalWidgetSharedError.keychainFailure(status)
    }
  }

  static func deleteAllTokens() throws {
    let status = SecItemDelete(try baseQuery() as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw JournalWidgetSharedError.keychainFailure(status)
    }
  }

  static func deleteLegacyToken() throws {
    var query = try baseQuery()
    query[kSecAttrAccount as String] = JournalWidgetConstants.keychainAccountPrefix
    let status = SecItemDelete(query as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw JournalWidgetSharedError.keychainFailure(status)
    }
  }

  private static func tokenQuery(sessionGeneration: Int) throws -> [String: Any] {
    var query = try baseQuery()
    query[kSecAttrAccount as String] =
      "\(JournalWidgetConstants.keychainAccountPrefix).\(sessionGeneration)"
    return query
  }

  private static func baseQuery() throws -> [String: Any] {
    guard let accessGroup = Bundle.main.object(
      forInfoDictionaryKey: JournalWidgetConstants.keychainAccessGroupInfoKey
    ) as? String,
    !accessGroup.isEmpty,
    !accessGroup.contains("$(") else {
      throw JournalWidgetSharedError.invalidKeychainAccessGroup
    }

    return [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: JournalWidgetConstants.keychainService,
      kSecAttrAccessGroup as String: accessGroup,
      kSecAttrSynchronizable as String: false,
    ]
  }
}

enum JournalWidgetURLValidator {
  static func normalizedAPIBaseURL(from rawValue: String) throws -> URL {
    let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
    guard var components = URLComponents(string: trimmed),
          let scheme = components.scheme?.lowercased(),
          let host = components.host?.lowercased(),
          !host.isEmpty,
          components.user == nil,
          components.password == nil,
          components.query == nil,
          components.fragment == nil else {
      throw JournalWidgetSharedError.invalidAPIBaseURL
    }

#if DEBUG
    let allowed = scheme == "https" || (scheme == "http" && isLocalDevelopmentHost(host))
#else
    let productionHost = (
      Bundle.main.object(
        forInfoDictionaryKey: JournalWidgetConstants.productionAPIHostInfoKey
      ) as? String
    )?.lowercased()
    let allowed = scheme == "https" && productionHost == host
#endif
    guard allowed else { throw JournalWidgetSharedError.invalidAPIBaseURL }

    while components.path.count > 1 && components.path.hasSuffix("/") {
      components.path.removeLast()
    }
    guard let normalizedURL = components.url else {
      throw JournalWidgetSharedError.invalidAPIBaseURL
    }
    return normalizedURL
  }

  private static func isLocalDevelopmentHost(_ host: String) -> Bool {
    if host == "localhost" || host == "::1" || host.hasSuffix(".local") {
      return true
    }
    if host.hasPrefix("127.") || host.hasPrefix("10.") || host.hasPrefix("192.168.") {
      return true
    }
    guard host.hasPrefix("172."),
          let secondOctet = Int(host.split(separator: ".").dropFirst().first ?? "") else {
      return false
    }
    return (16...31).contains(secondOctet)
  }
}
