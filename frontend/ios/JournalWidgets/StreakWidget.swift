import SwiftUI
import WidgetKit

private struct StreakEntry: TimelineEntry {
  let date: Date
  let snapshot: JournalWidgetStreakSnapshot
  let preferences: JournalWidgetPreferences
}

private struct StreakProvider: TimelineProvider {
  func placeholder(in context: Context) -> StreakEntry {
    StreakEntry(
      date: Date(),
      snapshot: JournalWidgetStreakSnapshot(
        schemaVersion: JournalWidgetConstants.schemaVersion,
        authState: .ready,
        currentStreak: 5,
        bestStreak: 12,
        thisMonthEntries: 9,
        totalEntries: 48,
        hasEntryToday: true,
        lastEntryDateKey: JournalWidgetStore.utcDateKey(),
        activity30Days: [
          true, false, true, true, false, true, true, true, false, true,
          true, false, true, true, true, false, true, true, false, true,
          true, true, false, true, true, true, true, false, true, true,
        ],
        updatedAt: Date()
      ),
      preferences: JournalWidgetPreferences(
        schemaVersion: JournalWidgetConstants.schemaVersion,
        isInitialized: true,
        enabledKinds: [JournalWidgetConstants.streakKind],
        hasPremiumAccess: false,
        updatedAt: Date()
      )
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
    completion(entry(at: Date()))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<StreakEntry>) -> Void
  ) {
    let now = Date()
    completion(
      Timeline(
        entries: [entry(at: now)],
        policy: .after(JournalWidgetTimeline.nextStreakRefresh(after: now))
      )
    )
  }

  private func entry(at date: Date) -> StreakEntry {
    let snapshot = (try? JournalWidgetStore().effectiveStreakSnapshot(at: date))
      ?? .signedOut(now: date)
    let preferences = (try? JournalWidgetStore().loadPreferences()) ?? .empty(now: date)
    return StreakEntry(date: date, snapshot: snapshot, preferences: preferences)
  }
}

private enum StreakPresentationState: Equatable {
  case disabled
  case connect
  case start
  case active
}

private struct StreakWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: StreakEntry

  private var state: StreakPresentationState {
    if !entry.preferences.isEnabled(JournalWidgetConstants.streakKind) {
      return .disabled
    }
    if entry.snapshot.authState != .ready {
      return .connect
    }
    return entry.snapshot.currentStreak > 0 ? .active : .start
  }

  var body: some View {
    Group {
      switch state {
      case .disabled:
        if family == .systemSmall {
          JournalWidgetSmallUnavailableView(
            symbol: "plus",
            title: "Streak",
            message: "Enable in Journal.IO",
            actionLabel: "Enable"
          )
        } else {
          JournalWidgetUnavailableView(
            symbol: "plus.square.on.square",
            title: "Enable Streak",
            message: "Choose this free widget in Journal.IO settings first.",
            actionLabel: "Enable"
          )
        }
      case .connect:
        StreakOpenAppView(
          title: "Your streak",
          message: "Open Journal.IO once to show your streak here."
        )
      case .start:
        StreakOpenAppView(
          title: entry.snapshot.totalEntries > 0 ? "Start a new streak" : "Start your streak",
          message: "Write today to begin a new run."
        )
      case .active:
        if family == .systemSmall {
          StreakSmallView(snapshot: entry.snapshot)
        } else {
          StreakMediumView(snapshot: entry.snapshot)
        }
      }
    }
    .widgetURL(
      URL(
        string: state == .disabled
          ? "journalio://widget/settings"
          : "journalio://widget/streaks"
      )!
    )
    .journalWidgetBackground()
  }
}

private struct StreakFlame: View {
  var size: CGFloat = 20

  var body: some View {
    Image(systemName: "flame.fill")
      .font(.system(size: size, weight: .semibold))
      .foregroundStyle(JournalWidgetColors.primary)
  }
}

private struct StreakSmallView: View {
  let snapshot: JournalWidgetStreakSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 6) {
        StreakFlame(size: 17)
        Text(snapshot.hasEntryToday ? "On track" : "Keep it going")
          .font(JournalWidgetFont.text(11, .semibold))
          .foregroundStyle(JournalWidgetColors.muted)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }

      Spacer(minLength: 4)

      Text("\(snapshot.currentStreak)")
        .font(JournalWidgetFont.text(43, .bold))
        .foregroundStyle(JournalWidgetColors.foreground)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text("day streak")
        .font(JournalWidgetFont.text(12, .medium))
        .foregroundStyle(JournalWidgetColors.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.8)

      Spacer(minLength: 5)

      HStack(spacing: 12) {
        StreakCompactStat(value: snapshot.bestStreak, label: "Best")
        StreakCompactStat(value: snapshot.thisMonthEntries, label: "Month")
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Current journaling streak: \(snapshot.currentStreak) days")
  }
}

private struct StreakMediumView: View {
  let snapshot: JournalWidgetStreakSnapshot

  var body: some View {
    HStack(alignment: .top, spacing: 8) {
      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 6) {
          StreakFlame(size: 17)
          Text(snapshot.hasEntryToday ? "On track today" : "Keep it going")
            .font(JournalWidgetFont.text(10, .semibold))
            .foregroundStyle(JournalWidgetColors.muted)
            .lineLimit(1)
            .minimumScaleFactor(0.75)
        }

        Spacer(minLength: 2)

        HStack(alignment: .firstTextBaseline, spacing: 5) {
          Text("\(snapshot.currentStreak)")
            .font(JournalWidgetFont.text(42, .bold))
            .foregroundStyle(JournalWidgetColors.foreground)
            .lineLimit(1)
            .minimumScaleFactor(0.6)
          Text("day streak")
            .font(JournalWidgetFont.text(11, .medium))
            .foregroundStyle(JournalWidgetColors.muted)
            .lineLimit(1)
        }

        Spacer(minLength: 4)

        HStack(spacing: 13) {
          StreakCompactStat(value: snapshot.bestStreak, label: "Best")
          StreakCompactStat(value: snapshot.thisMonthEntries, label: "Month")
        }
        .padding(.leading, 4)
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

      StreakActivityGrid(activity: snapshot.activity30Days)
        .frame(width: 147, alignment: .leading)
        .frame(maxHeight: .infinity, alignment: .topLeading)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      "Current streak \(snapshot.currentStreak) days. Best \(snapshot.bestStreak) days. "
        + "\(snapshot.thisMonthEntries) entries this month."
    )
  }
}

private struct StreakCompactStat: View {
  let value: Int
  let label: String

  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text("\(value)")
        .font(JournalWidgetFont.text(15, .bold))
        .foregroundStyle(JournalWidgetColors.foreground)
      Text(label)
        .font(JournalWidgetFont.text(9, .medium))
        .foregroundStyle(JournalWidgetColors.muted)
    }
  }
}

private struct StreakActivityGrid: View {
  let activity: [Bool]?
  private let columns = Array(
    repeating: GridItem(.fixed(12), spacing: 3),
    count: 10
  )

  private var days: [Bool] {
    guard let activity, activity.count == 30 else {
      return Array(repeating: false, count: 30)
    }
    return activity
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      Text("30-Day Activity")
        .font(JournalWidgetFont.text(11, .bold))
        .foregroundStyle(JournalWidgetColors.foreground)
        .lineLimit(1)

      LazyVGrid(columns: columns, alignment: .leading, spacing: 3) {
        ForEach(Array(days.enumerated()), id: \.offset) { index, isActive in
          RoundedRectangle(cornerRadius: 3, style: .continuous)
            .fill(
              isActive
                ? JournalWidgetColors.primary
                : JournalWidgetColors.primary.opacity(0.13)
            )
            .frame(width: 12, height: 12)
            .overlay {
              if index == 29 {
                RoundedRectangle(cornerRadius: 3, style: .continuous)
                  .stroke(JournalWidgetColors.primary.opacity(0.55), lineWidth: 1)
              }
            }
        }
      }
      .frame(width: 147, alignment: .leading)

      Text("Your writing consistency")
        .font(JournalWidgetFont.text(9))
        .foregroundStyle(JournalWidgetColors.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.75)
    }
  }
}

private struct StreakOpenAppView: View {
  let title: String
  let message: String
  var body: some View {
    HStack(spacing: 14) {
        ZStack {
          RoundedRectangle(cornerRadius: 14, style: .continuous)
            .fill(JournalWidgetColors.primary.opacity(0.14))
          Image(systemName: "flame.fill")
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
            .fixedSize(horizontal: false, vertical: true)
        }

        Spacer(minLength: 0)
      }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .contentShape(Rectangle())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(title). \(message)")
  }
}

struct StreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: JournalWidgetConstants.streakKind,
      provider: StreakProvider()
    ) { entry in
      StreakWidgetView(entry: entry)
    }
    .configurationDisplayName("Streak")
    .description("See your journaling streak from your Home Screen.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
