import AppIntents
import Foundation
import WidgetKit

@available(iOSApplicationExtension 16.0, *)
struct LogMoodIntent: AppIntent {
  static var title: LocalizedStringResource = "Log mood"
  static var description = IntentDescription("Save today’s mood in Journal.IO.")
  static var openAppWhenRun = false

  @Parameter(title: "Mood")
  var mood: String

  init() { mood = "okay" }
  init(mood: String) { self.mood = mood }

  func perform() async throws -> some IntentResult {
    guard MoodIntentValue(rawValue: mood) != nil else { return .result() }
    await MoodIntentRequest.perform(mood: mood)
    return .result()
  }
}

@available(iOSApplicationExtension 16.0, *)
private enum MoodIntentValue: String {
  case amazing
  case good
  case okay
  case bad
  case terrible
}

@available(iOSApplicationExtension 16.0, *)
private enum MoodIntentRequest {
  private struct APIResponse: Decodable {
    let success: Bool
    let data: ResponseData?
  }

  private struct ResponseData: Decodable {
    let saved: Bool
    let moodDateKey: String
    let alreadyCheckedIn: Bool
    let mood: String?
  }

  private enum RequestResult {
    case saved(String, JournalWidgetMood)
    case reconnect
    case premiumRequired
    case retry
  }

  static func perform(mood: String) async {
    guard let store = try? JournalWidgetStore(),
          let configuration = store.loadConfiguration() else {
      persistReconnect()
      return
    }

    let generation = configuration.sessionGeneration
    guard configuration.tokenExpiresAt > Date(),
          let token = try? JournalWidgetKeychain.readToken(
            sessionGeneration: generation
          ),
          !token.isEmpty else {
      persistReconnect(expectedGeneration: generation)
      return
    }

    persist(
      status: .submitting,
      authState: .ready,
      hasCheckedInToday: false,
      moodDateKey: nil,
      selectedMood: nil,
      expectedGeneration: generation
    )

    do {
      let response = try await send(
        mood: mood,
        token: token,
        configuration: configuration
      )
      switch response {
      case .saved(let moodDateKey, let selectedMood):
        persist(
          status: .saved,
          authState: .ready,
          hasCheckedInToday: true,
          moodDateKey: moodDateKey,
          selectedMood: selectedMood,
          expectedGeneration: generation
        )
      case .reconnect:
        persistReconnect(expectedGeneration: generation)
      case .premiumRequired:
        persistPremiumRequired(expectedGeneration: generation)
      case .retry:
        persist(
          status: .retry,
          authState: .ready,
          hasCheckedInToday: false,
          moodDateKey: nil,
          selectedMood: nil,
          expectedGeneration: generation
        )
      }
    } catch {
      persist(
        status: .retry,
        authState: .ready,
        hasCheckedInToday: false,
        moodDateKey: nil,
        selectedMood: nil,
        expectedGeneration: generation
      )
    }
  }

  private static func send(
    mood: String,
    token: String,
    configuration: JournalWidgetSessionConfiguration
  ) async throws -> RequestResult {
    guard let baseURL = try? JournalWidgetURLValidator.normalizedAPIBaseURL(
      from: configuration.apiBaseURL
    ) else {
      return .reconnect
    }

    let endpoint = baseURL
      .appendingPathComponent("widgets", isDirectory: true)
      .appendingPathComponent("mood", isDirectory: true)
      .appendingPathComponent("check_in", isDirectory: false)
    var request = URLRequest(url: endpoint, timeoutInterval: 8)
    request.httpMethod = "POST"
    request.setValue("Widget \(token)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue(TimeZone.current.identifier, forHTTPHeaderField: "X-Client-Timezone")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["mood": mood])

    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 8
    configuration.timeoutIntervalForResource = 10
    configuration.waitsForConnectivity = false
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    let (data, response) = try await URLSession(configuration: configuration).data(for: request)

    guard let httpResponse = response as? HTTPURLResponse else { return .retry }
    if httpResponse.statusCode == 401 {
      return .reconnect
    }
    if httpResponse.statusCode == 403 {
      return .premiumRequired
    }
    if httpResponse.statusCode == 409 {
      return .saved(
        JournalWidgetStore.moodDateKey(),
        JournalWidgetMood(rawValue: mood) ?? .okay
      )
    }
    guard (200...299).contains(httpResponse.statusCode),
          let decoded = try? JSONDecoder().decode(APIResponse.self, from: data),
          decoded.success,
          let responseData = decoded.data,
          responseData.saved,
          JournalWidgetStore.isValidMoodDateKey(responseData.moodDateKey),
          let selectedMood = JournalWidgetMood(
            rawValue: responseData.mood ?? mood
          ) else {
      return .retry
    }
    return .saved(responseData.moodDateKey, selectedMood)
  }

  private static func persistReconnect(expectedGeneration: Int? = nil) {
    if let expectedGeneration {
      try? JournalWidgetKeychain.deleteToken(
        sessionGeneration: expectedGeneration
      )
    }
    persist(
      status: .idle,
      authState: .reconnectRequired,
      hasCheckedInToday: false,
      moodDateKey: nil,
      selectedMood: nil,
      expectedGeneration: expectedGeneration
    )
  }

  private static func persistPremiumRequired(expectedGeneration: Int?) {
    if let expectedGeneration {
      try? JournalWidgetKeychain.deleteToken(
        sessionGeneration: expectedGeneration
      )
    }
    persist(
      status: .idle,
      authState: .premiumRequired,
      hasCheckedInToday: false,
      moodDateKey: nil,
      selectedMood: nil,
      expectedGeneration: expectedGeneration
    )
  }

  private static func persist(
    status: JournalWidgetActionStatus,
    authState: JournalWidgetAuthState,
    hasCheckedInToday: Bool,
    moodDateKey: String?,
    selectedMood: JournalWidgetMood?,
    expectedGeneration: Int?
  ) {
    guard let store = try? JournalWidgetStore() else { return }
    let configuration = store.loadConfiguration()
    if let expectedGeneration,
       configuration?.sessionGeneration != expectedGeneration {
      return
    }

    let now = Date()
    var snapshot = store.loadSnapshot()
    snapshot.schemaVersion = JournalWidgetConstants.schemaVersion
    snapshot.sessionGeneration = configuration?.sessionGeneration
      ?? expectedGeneration
      ?? snapshot.sessionGeneration
    snapshot.authState = authState
    snapshot.moodDateKey = moodDateKey
    snapshot.selectedMood = selectedMood
    snapshot.hasCheckedInToday = hasCheckedInToday
    snapshot.lastActionStatus = status
    snapshot.lastActionAt = status == .idle ? nil : now
    snapshot.updatedAt = now
    try? store.saveSnapshot(snapshot)
    WidgetCenter.shared.reloadTimelines(ofKind: JournalWidgetConstants.moodKind)
  }
}
