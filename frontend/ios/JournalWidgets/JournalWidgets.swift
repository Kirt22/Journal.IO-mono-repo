import SwiftUI
import WidgetKit

/// Widget-side mirror of `src/theme/typography.ts`.
///
/// The fonts ship in this target too (see `UIAppFonts` in Info.plist), so the
/// widgets read as the same product as the app instead of falling back to the
/// system face. Weights map onto one static cut each, and type at or above
/// `displaySizeThreshold` switches to Bricolage Grotesque — the same 22pt rule
/// the app applies in `roleForSize`.
///
/// SF Symbols and emoji deliberately keep `.system`: a custom family has no
/// glyphs for them and would render blank.
enum JournalWidgetFont {
  static let displaySizeThreshold: CGFloat = 22

  static func ui(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
    Font.custom(uiName(for: weight), size: size)
  }

  static func display(_ size: CGFloat, _ weight: Font.Weight = .bold) -> Font {
    Font.custom(
      weight == .semibold
        ? "BricolageGrotesque-SemiBold"
        : "BricolageGrotesque-Bold",
      size: size
    )
  }

  /// Picks the register from size so widget text follows the same rule as the app.
  static func text(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
    size >= displaySizeThreshold ? display(size, weight) : ui(size, weight)
  }

  private static func uiName(for weight: Font.Weight) -> String {
    switch weight {
    case .bold, .heavy, .black:
      return "SchibstedGrotesk-Bold"
    case .semibold:
      return "SchibstedGrotesk-SemiBold"
    case .medium:
      return "SchibstedGrotesk-Medium"
    default:
      return "SchibstedGrotesk-Regular"
    }
  }
}

@main
struct JournalWidgets: WidgetBundle {
  var body: some Widget {
    // WidgetKit caches this descriptor list when the extension is installed.
    // Preferences gate widget content, never whether a kind is registered.
    QuickThoughtWidget()
    MoodCheckInWidget()
    StreakWidget()
  }
}

enum JournalWidgetColors {
  static let background = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 26 / 255, green: 24 / 255, blue: 22 / 255, alpha: 1)
        : UIColor(red: 253 / 255, green: 252 / 255, blue: 251 / 255, alpha: 1)
    }
  )
  static let card = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 45 / 255, green: 42 / 255, blue: 38 / 255, alpha: 1)
        : .white
    }
  )
  static let foreground = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 245 / 255, green: 241 / 255, blue: 237 / 255, alpha: 1)
        : UIColor(red: 45 / 255, green: 42 / 255, blue: 38 / 255, alpha: 1)
    }
  )
  static let muted = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 163 / 255, green: 157 / 255, blue: 150 / 255, alpha: 1)
        : UIColor(red: 131 / 255, green: 125 / 255, blue: 119 / 255, alpha: 1)
    }
  )
  static let border = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 58 / 255, green: 55 / 255, blue: 50 / 255, alpha: 1)
        : UIColor(red: 229 / 255, green: 223 / 255, blue: 217 / 255, alpha: 1)
    }
  )
  static let primary = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 1, green: 138 / 255, blue: 117 / 255, alpha: 1)
        : UIColor(red: 232 / 255, green: 116 / 255, blue: 97 / 255, alpha: 1)
    }
  )
  static let success = Color(
    uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark
        ? UIColor(red: 123 / 255, green: 199 / 255, blue: 134 / 255, alpha: 1)
        : UIColor(red: 107 / 255, green: 170 / 255, blue: 117 / 255, alpha: 1)
    }
  )
}

extension View {
  @ViewBuilder
  func journalWidgetBackground() -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      containerBackground(for: .widget) {
        JournalWidgetColors.background
      }
    } else {
      background(JournalWidgetColors.background)
    }
  }
}

enum JournalWidgetTimeline {
  static func nextLocalMidnight(after date: Date) -> Date {
    nextMidnight(after: date, calendar: .current)
  }

  /// Streaks roll over on UTC day boundaries (the backend computes them in UTC),
  /// so the Streaks widget refreshes at the sooner of the next local or UTC
  /// midnight to stay self-consistent regardless of the device's time zone.
  static func nextStreakRefresh(after date: Date) -> Date {
    var utcCalendar = Calendar(identifier: .gregorian)
    utcCalendar.timeZone = TimeZone(secondsFromGMT: 0) ?? .current
    return min(
      nextMidnight(after: date, calendar: .current),
      nextMidnight(after: date, calendar: utcCalendar)
    )
  }

  private static func nextMidnight(after date: Date, calendar: Calendar) -> Date {
    let startOfToday = calendar.startOfDay(for: date)
    let startOfTomorrow = calendar.date(byAdding: .day, value: 1, to: startOfToday)
      ?? date.addingTimeInterval(24 * 60 * 60)
    return startOfTomorrow.addingTimeInterval(60)
  }
}

struct JournalWidgetUnavailableView: View {
  let symbol: String
  let title: String
  let message: String
  let actionLabel: String

  var body: some View {
    HStack(spacing: 14) {
      ZStack {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .fill(JournalWidgetColors.primary.opacity(0.14))
        Image(systemName: symbol)
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

struct JournalWidgetSmallUnavailableView: View {
  let symbol: String
  let title: String
  let message: String
  let actionLabel: String

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      HStack(spacing: 8) {
        ZStack {
          RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(JournalWidgetColors.primary.opacity(0.14))
          Image(systemName: symbol)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(JournalWidgetColors.primary)
        }
        .frame(width: 38, height: 38)

        Spacer(minLength: 0)

        Text(actionLabel)
          .font(JournalWidgetFont.text(11, .bold))
          .foregroundStyle(JournalWidgetColors.primary)
          .padding(.horizontal, 10)
          .frame(height: 30)
          .background(JournalWidgetColors.primary.opacity(0.12))
          .clipShape(Capsule())
      }

      Spacer(minLength: 8)

      Text(title)
        .font(JournalWidgetFont.text(17, .bold))
        .foregroundStyle(JournalWidgetColors.foreground)
        .lineLimit(2)
        .minimumScaleFactor(0.82)
      Text(message)
        .font(JournalWidgetFont.text(11))
        .foregroundStyle(JournalWidgetColors.muted)
        .lineLimit(2)
        .minimumScaleFactor(0.82)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .contentShape(Rectangle())
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("\(title). \(message). \(actionLabel)")
  }
}
