import SwiftUI
import WidgetKit

private struct JournalWidgetLoader: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  let color: Color
  var size: CGFloat = 20

  var body: some View {
    Group {
      if reduceMotion {
        arc(length: 0.32, rotation: -90)
      } else {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0)) { context in
          let phase = context.date.timeIntervalSinceReferenceDate
            .truncatingRemainder(dividingBy: 1.6) / 1.6
          let triangle = phase < 0.5 ? phase * 2 : (1 - phase) * 2
          let eased = triangle * triangle * (3 - 2 * triangle)

          arc(
            length: 0.12 + (0.76 * eased),
            rotation: -90 + (phase * 360)
          )
        }
      }
    }
    .frame(width: size, height: size)
    .accessibilityHidden(true)
  }

  private func arc(length: Double, rotation: Double) -> some View {
    Circle()
      .trim(from: 0, to: length)
      .stroke(
        color,
        style: StrokeStyle(lineWidth: size * 0.09, lineCap: .round)
      )
      .rotationEffect(.degrees(rotation))
  }
}

private struct MoodEntry: TimelineEntry {
  let date: Date
  let snapshot: JournalWidgetSnapshot
  let preferences: JournalWidgetPreferences
}

private struct MoodProvider: TimelineProvider {
  func placeholder(in context: Context) -> MoodEntry {
    MoodEntry(
      date: Date(),
      snapshot: JournalWidgetSnapshot(
        schemaVersion: JournalWidgetConstants.schemaVersion,
        sessionGeneration: 1,
        authState: .ready,
        moodDateKey: nil,
        selectedMood: nil,
        hasCheckedInToday: false,
        lastActionStatus: .idle,
        lastActionAt: nil,
        updatedAt: Date()
      ),
      preferences: JournalWidgetPreferences(
        schemaVersion: JournalWidgetConstants.schemaVersion,
        isInitialized: true,
        enabledKinds: [JournalWidgetConstants.moodKind],
        hasPremiumAccess: true,
        updatedAt: Date()
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (MoodEntry) -> Void) {
    completion(entry(at: Date()))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<MoodEntry>) -> Void
  ) {
    let now = Date()
    completion(
      Timeline(
        entries: [entry(at: now)],
        policy: .after(JournalWidgetTimeline.nextLocalMidnight(after: now))
      )
    )
  }

  private func entry(at date: Date) -> MoodEntry {
    let snapshot = (try? JournalWidgetStore().effectiveSnapshot(at: date))
      ?? .signedOut(now: date)
    let preferences = (try? JournalWidgetStore().loadPreferences()) ?? .empty(now: date)
    return MoodEntry(date: date, snapshot: snapshot, preferences: preferences)
  }
}

extension JournalWidgetMood: Identifiable {
  var id: String { rawValue }
  var label: String { rawValue.prefix(1).uppercased() + rawValue.dropFirst() }
  var symbol: String {
    switch self {
    case .amazing: return "🤩"
    case .good: return "😊"
    case .okay: return "😌"
    case .bad: return "😔"
    case .terrible: return "😢"
    }
  }
}

private enum MoodPresentationState: Equatable {
  case disabled
  case premium
  case connect
  case ready
  case submitting
  case saved
  case retry
  case reconnect
}

private struct MoodCheckInWidgetView: View {
  let entry: MoodEntry

  private var state: MoodPresentationState {
    if !entry.preferences.isEnabled(JournalWidgetConstants.moodKind) {
      return .disabled
    }
    if !entry.preferences.hasPremiumAccess
      || entry.snapshot.authState == .premiumRequired {
      return .premium
    }
    switch entry.snapshot.authState {
    case .signedOut:
      return .connect
    case .reconnectRequired:
      return .reconnect
    case .premiumRequired:
      return .premium
    case .ready:
      if entry.snapshot.hasCheckedInToday { return .saved }
      switch entry.snapshot.lastActionStatus {
      case .submitting: return .submitting
      case .saved, .idle: return .ready
      case .retry: return .retry
      }
    }
  }

  private var destination: URL {
    switch state {
    case .disabled:
      return URL(string: "journalio://widget/settings")!
    case .saved:
      return URL(string: "journalio://widget/home")!
    case .premium, .connect, .ready, .submitting, .retry, .reconnect:
      return URL(string: "journalio://widget/mood")!
    }
  }

  var body: some View {
    Group {
      switch state {
      case .disabled:
        JournalWidgetUnavailableView(
          symbol: "plus.square.on.square",
          title: "Enable Mood Check-in",
          message: "Choose this widget in Journal.IO settings first.",
          actionLabel: "Enable"
        )
      case .premium:
        JournalWidgetUnavailableView(
          symbol: "lock.fill",
          title: "Mood Check-in",
          message: "Home Screen mood check-ins are included with Premium.",
          actionLabel: "View"
        )
      case .connect:
        OpenAppStateView(
          title: "How are you feeling?",
          message: "Open Journal.IO once to connect this widget.",
          actionLabel: "Connect"
        )
      case .reconnect:
        OpenAppStateView(
          title: "Reconnect Journal.IO",
          message: "Your private widget session needs refreshing.",
          actionLabel: "Reconnect"
        )
      case .submitting:
        VStack(spacing: 10) {
          JournalWidgetLoader(color: JournalWidgetColors.primary)
          Text("Saving your check-in…")
            .font(JournalWidgetFont.text(15, .semibold))
            .foregroundStyle(JournalWidgetColors.foreground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Saving your mood check-in")
      case .saved:
        MoodSavedView(snapshot: entry.snapshot)
      case .ready:
        MoodChoicesView(showsRetryMessage: false)
      case .retry:
        MoodChoicesView(showsRetryMessage: true)
      }
    }
    .widgetURL(destination)
    .journalWidgetBackground()
  }
}

private struct MoodSavedView: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let snapshot: JournalWidgetSnapshot

  private var mood: JournalWidgetMood {
    snapshot.selectedMood ?? .okay
  }

  var body: some View {
    HStack(spacing: 17) {
      ZStack(alignment: .bottomTrailing) {
        Text(mood.symbol)
          .font(.system(size: 45))
          .frame(width: 64, height: 64)
          .background(JournalWidgetColors.card)
          .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
          .overlay {
            RoundedRectangle(cornerRadius: 20, style: .continuous)
              .stroke(JournalWidgetColors.border, lineWidth: 1)
          }

        animatedCheckmark
          .offset(x: 4, y: 4)
      }

      VStack(alignment: .leading, spacing: 4) {
        Text(mood.label)
          .font(JournalWidgetFont.text(19, .bold))
          .foregroundStyle(JournalWidgetColors.foreground)
        Text("Check-in saved today")
          .font(JournalWidgetFont.text(14, .semibold))
          .foregroundStyle(JournalWidgetColors.foreground)
        Text("Tap to return home")
          .font(JournalWidgetFont.text(11))
          .foregroundStyle(JournalWidgetColors.muted)
      }

      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(mood.label) mood. Check-in saved today. Tap to return home.")
  }

  @ViewBuilder
  private var animatedCheckmark: some View {
    let image = Image(systemName: "checkmark.circle.fill")
      .font(.system(size: 28, weight: .semibold))
      .foregroundStyle(JournalWidgetColors.success)
      .background(Circle().fill(JournalWidgetColors.background))

    if #available(iOSApplicationExtension 17.0, *), !reduceMotion {
      image.symbolEffect(
        .bounce,
        options: .nonRepeating,
        value: snapshot.lastActionAt
      )
    } else {
      image
    }
  }
}

private struct MoodChoicesView: View {
  let showsRetryMessage: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 11) {
      HStack(alignment: .center, spacing: 7) {
        Image(systemName: "heart.text.square.fill")
          .font(.system(size: 15, weight: .semibold))
          .foregroundStyle(JournalWidgetColors.primary)
        Text("How are you feeling?")
          .font(JournalWidgetFont.text(16, .bold))
          .foregroundStyle(JournalWidgetColors.foreground)
        Spacer(minLength: 6)
        if showsRetryMessage {
          Text("Couldn’t save. Try again.")
            .font(JournalWidgetFont.text(10, .medium))
            .foregroundStyle(JournalWidgetColors.primary)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }
      }

      HStack(spacing: 8) {
        ForEach(JournalWidgetMood.allCases) { mood in
          MoodChoiceButton(mood: mood)
        }
      }
      .frame(maxHeight: .infinity)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

private struct MoodChoiceButton: View {
  let mood: JournalWidgetMood

  var body: some View {
    Group {
      if #available(iOSApplicationExtension 17.0, *) {
        Button(intent: LogMoodIntent(mood: mood.rawValue)) { label }
          .buttonStyle(.plain)
      } else {
        Link(destination: fallbackURL) { label }
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Log mood: \(mood.label)")
    .frame(maxWidth: .infinity, minHeight: 54, maxHeight: .infinity)
  }

  private var label: some View {
    VStack(spacing: 5) {
      Text(mood.symbol).font(.system(size: 24))
      Text(mood.label)
        .font(JournalWidgetFont.text(9, .semibold))
        .foregroundStyle(JournalWidgetColors.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, minHeight: 54, maxHeight: .infinity)
    .background(JournalWidgetColors.card)
    .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 15, style: .continuous)
        .stroke(JournalWidgetColors.border, lineWidth: 1)
    }
    .contentShape(Rectangle())
  }

  private var fallbackURL: URL {
    var components = URLComponents(string: "journalio://widget/mood")!
    components.queryItems = [URLQueryItem(name: "value", value: mood.rawValue)]
    return components.url!
  }
}

private struct OpenAppStateView: View {
  let title: String
  let message: String
  let actionLabel: String
  var body: some View {
    HStack(spacing: 14) {
        ZStack {
          RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(JournalWidgetColors.primary.opacity(0.14))
          Image(systemName: "heart.text.square")
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(JournalWidgetColors.primary)
        }
        .frame(width: 48, height: 48)

        VStack(alignment: .leading, spacing: 4) {
          Text(title)
            .font(JournalWidgetFont.text(16, .bold))
            .foregroundStyle(JournalWidgetColors.foreground)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
          Text(message)
            .font(JournalWidgetFont.text(12))
            .foregroundStyle(JournalWidgetColors.muted)
            .lineLimit(2)
        }

        Spacer(minLength: 4)
        Text(actionLabel)
          .font(JournalWidgetFont.text(12, .bold))
          .foregroundStyle(JournalWidgetColors.primary)
          .padding(.horizontal, 11)
          .frame(minHeight: 44)
          .background(JournalWidgetColors.primary.opacity(0.12))
          .clipShape(Capsule())
      }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .contentShape(Rectangle())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(title). \(message). \(actionLabel)")
  }
}

struct MoodCheckInWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: JournalWidgetConstants.moodKind,
      provider: MoodProvider()
    ) { entry in
      MoodCheckInWidgetView(entry: entry)
    }
    .configurationDisplayName("Mood Check-in")
    .description("Save a private daily mood check-in from your Home Screen.")
    .supportedFamilies([.systemMedium])
  }
}
