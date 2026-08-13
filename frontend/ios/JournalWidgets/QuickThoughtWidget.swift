import SwiftUI
import WidgetKit

private struct QuickThoughtEntry: TimelineEntry {
  let date: Date
  let preferences: JournalWidgetPreferences
}

private struct QuickThoughtProvider: TimelineProvider {
  func placeholder(in context: Context) -> QuickThoughtEntry {
    QuickThoughtEntry(
      date: Date(),
      preferences: JournalWidgetPreferences(
        schemaVersion: JournalWidgetConstants.schemaVersion,
        isInitialized: true,
        enabledKinds: [JournalWidgetConstants.quickThoughtKind],
        hasPremiumAccess: true,
        updatedAt: Date()
      )
    )
  }

  func getSnapshot(
    in context: Context,
    completion: @escaping (QuickThoughtEntry) -> Void
  ) {
    completion(entry(at: Date()))
  }

  func getTimeline(
    in context: Context,
    completion: @escaping (Timeline<QuickThoughtEntry>) -> Void
  ) {
    let now = Date()
    completion(
      Timeline(
        entries: [entry(at: now)],
        policy: .after(JournalWidgetTimeline.nextLocalMidnight(after: now))
      )
    )
  }

  private func entry(at date: Date) -> QuickThoughtEntry {
    let preferences = (try? JournalWidgetStore().loadPreferences()) ?? .empty(now: date)
    return QuickThoughtEntry(date: date, preferences: preferences)
  }
}

private struct QuickThoughtWidgetView: View {
  let entry: QuickThoughtEntry

  private var isEnabled: Bool {
    entry.preferences.isEnabled(JournalWidgetConstants.quickThoughtKind)
  }

  private var destination: URL {
    URL(
      string: isEnabled
        ? "journalio://widget/quick-thought"
        : "journalio://widget/settings"
    )!
  }

  var body: some View {
    Group {
      if !isEnabled {
        JournalWidgetSmallUnavailableView(
          symbol: "plus",
          title: "Quick Thought",
          message: "Enable in Journal.IO",
          actionLabel: "Enable"
        )
      } else if !entry.preferences.hasPremiumAccess {
        JournalWidgetSmallUnavailableView(
          symbol: "lock.fill",
          title: "Quick Thought",
          message: "Available with Premium",
          actionLabel: "View"
        )
      } else {
      VStack(alignment: .leading, spacing: 0) {
        ZStack {
          RoundedRectangle(cornerRadius: 15, style: .continuous)
            .fill(JournalWidgetColors.primary.opacity(0.14))
          Image(systemName: "square.and.pencil")
            .font(.system(size: 22, weight: .semibold))
            .foregroundStyle(JournalWidgetColors.primary)
        }
        .frame(width: 46, height: 46)

        Spacer(minLength: 10)

        Text("Quick thought")
          .font(JournalWidgetFont.text(18, .bold))
          .foregroundStyle(JournalWidgetColors.foreground)
          .lineLimit(1)
          .minimumScaleFactor(0.85)
        Text("Capture what’s on your mind")
          .font(JournalWidgetFont.text(12, .regular))
          .foregroundStyle(JournalWidgetColors.muted)
          .lineLimit(2)
          .fixedSize(horizontal: false, vertical: true)

        Spacer(minLength: 8)

        HStack(spacing: 5) {
          Text("Write")
            .font(JournalWidgetFont.text(12, .semibold))
            .foregroundStyle(JournalWidgetColors.primary)
          Image(systemName: "arrow.right")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(JournalWidgetColors.primary)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .background(JournalWidgetColors.primary.opacity(0.12))
        .clipShape(Capsule())
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .contentShape(Rectangle())
      }
    }
    .widgetURL(destination)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Open Journal.IO to capture a quick thought")
    .journalWidgetBackground()
  }
}

struct QuickThoughtWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(
      kind: JournalWidgetConstants.quickThoughtKind,
      provider: QuickThoughtProvider()
    ) { entry in
      QuickThoughtWidgetView(entry: entry)
    }
    .configurationDisplayName("Quick Thought")
    .description("Open Journal.IO with the quick thought composer ready.")
    .supportedFamilies([.systemSmall])
  }
}
