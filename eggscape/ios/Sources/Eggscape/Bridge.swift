import CoreHaptics
import Foundation
import UIKit

enum GameConfig {
    static let scheme = "eggscape"
    static let startURL = URL(string: "eggscape://localhost/index.html")!
    /// the message handler the page posts to: window.webkit.messageHandlers.egg
    static let handlerName = "egg"
    /// the page's save and notes, kept by recover() for the next page (unstash), as the Android shell does
    static let stashKey = "egg.stash"
    /// the home screen's sky, as on Android (#428abe), shown before the page's first frame
    static let background = UIColor(red: 0x42 / 255.0, green: 0x8a / 255.0, blue: 0xbe / 255.0, alpha: 1)
}

/// The page's side of the bridge: window.EggApp with the Android shell's method names (MainActivity.Bridge), so the
/// game's existing code paths run unchanged. WebKit's messages are one-way, so the methods that answer at once
/// (deviceInfo, hapticInfo, openedFrom, unstash) read a snapshot the app keeps up to date (window.__eggIOS), and the
/// ones that act (vibrate, vibratePattern, shareLog, recover) post to the app.
/// Not here on purpose: buy, restorePurchases, showRewarded, showInterstitial, setChildSafe and notify*. Purchases,
/// ads and reminders are not wired on iOS yet; the page is the web build, which sells nothing.
enum Bootstrap {
    static func source(stateJSON: String) -> String {
        "(function(){var S=" + stateJSON + ";" + body + "})();"
    }

    private static let body = #"""
    var post = function (m) { try { window.webkit.messageHandlers.egg.postMessage(m); } catch (e) { /* no app side */ } };
    var copy = function (a, b) { for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; };
    var sent = 0;
    window.__eggIOS = function (p) { if (p && p.dev) S.dev = p.dev; };
    window.EGG_APP = true;
    window.EggApp = {
      deviceInfo: function (full) { var o = copy({}, S.dev || {}); if (full) copy(o, S.full || {}); return JSON.stringify(o); },
      hapticInfo: function () { return JSON.stringify({ has: S.haptic ? 1 : 0, saver: (S.dev && S.dev.powerSave) || 0, sent: sent }); },
      vibrate: function (ms) { ms = ms | 0; if (ms > 0) { sent++; post({ fn: 'vibrate', ms: ms }); } },
      vibratePattern: function (csv) { sent++; post({ fn: 'pattern', csv: String(csv == null ? '' : csv) }); },
      openedFrom: function () { return ''; },
      shareLog: function (name, text) { post({ fn: 'share', name: String(name || ''), text: String(text || '') }); },
      recover: function (rung, keep) { post({ fn: 'recover', rung: rung | 0, keep: String(keep || '') }); },
      unstash: function () { var v = S.stash || ''; if (v) { S.stash = ''; post({ fn: 'unstash' }); } return v; }
    };
    // WebKit has no navigator.vibrate. The game buzzes through EggApp (src/app.js); this only lets its Settings show
    // the Vibration switch, which it offers where navigator.vibrate exists.
    try {
      if (typeof navigator.vibrate !== 'function') {
        Object.defineProperty(navigator, 'vibrate', { configurable: true, value: function (p) {
          if (Array.isArray(p)) window.EggApp.vibratePattern(p.join(',')); else window.EggApp.vibrate(+p || 0);
          return true;
        } });
      }
    } catch (e) { /* no switch then */ }
    // like a game: muted by the silent switch, mixed with other audio (iOS 17+; the app's audio session says the same)
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* older WebKit */ }
    """#
}

/// Buzzes for the page: one beat of n ms becomes a tap of matching weight (iPhones cannot buzz for a set time).
@MainActor
final class Haptics {
    private let light = UIImpactFeedbackGenerator(style: .light)
    private let medium = UIImpactFeedbackGenerator(style: .medium)
    private let heavy = UIImpactFeedbackGenerator(style: .heavy)
    private let notice = UINotificationFeedbackGenerator()

    /// the phone has a Taptic Engine (every iPhone since the 8; no iPad has one)
    let available: Bool = CHHapticEngine.capabilitiesForHardware().supportsHaptics

    func prepare() {
        light.prepare()
        medium.prepare()
        heavy.prepare()
        notice.prepare()
    }

    /// one beat: short ones a light tap, 30 ms and more a firm one, 60 ms a heavy one, 100 ms and more (the game's
    /// long beats: a fail, the end of a win) the system's double "warning" thump, which reads as a long buzz
    func pulse(ms: Int) {
        let ms = min(ms, 500)
        guard ms > 0 else { return }
        switch ms {
        case ..<30: light.impactOccurred(intensity: 0.8)
        case ..<60: medium.impactOccurred()
        case ..<100: heavy.impactOccurred()
        default: notice.notificationOccurred(.warning)
        }
    }

    /// "on,off,on,..." in ms, as on Android: each "on" beat is played at its time
    func pattern(_ csv: String) {
        var at = 0
        for (i, part) in csv.split(separator: ",").prefix(12).enumerated() {
            let v = max(0, min(400, Int(part.trimmingCharacters(in: .whitespaces)) ?? 0))
            if i % 2 == 0 && v > 0 {
                if at == 0 {
                    pulse(ms: v)
                } else {
                    let delay = UInt64(at) * 1_000_000
                    Task { @MainActor [weak self] in
                        try? await Task.sleep(nanoseconds: delay)
                        self?.pulse(ms: v)
                    }
                }
            }
            at += v
        }
    }
}

/// What the speed log (src/diag.js) gets from deviceInfo(full): the Android keys where iOS has the same fact.
@MainActor
enum DeviceFacts {
    /// the facts that change while the game runs
    static func live(trims: Int, renderGone: Int, cures: Int, hz: Int) -> [String: Any] {
        let info = ProcessInfo.processInfo
        var o: [String: Any] = [
            "powerSave": info.isLowPowerModeEnabled ? 1 : 0,
            "thermal": thermal(info.thermalState),
            "trim": trims,
            "renderGone": renderGone,
            "hz": hz,
        ]
        if cures > 0 { o["cures"] = cures }
        let device = UIDevice.current
        if device.batteryLevel >= 0 { o["battery"] = Int((device.batteryLevel * 100).rounded()) }
        o["charging"] = device.batteryState == .charging || device.batteryState == .full ? 1 : 0
        return o
    }

    /// the facts that never change
    static func fixed(scale: CGFloat) -> [String: Any] {
        let info = ProcessInfo.processInfo
        var name = utsname()
        uname(&name)
        let model = withUnsafeBytes(of: name.machine) { raw in
            String(decoding: raw.prefix(while: { $0 != 0 }), as: UTF8.self)
        }
        return [
            "maker": "Apple",
            "model": model,
            "device": UIDevice.current.model,
            "ios": UIDevice.current.systemVersion,
            "cores": info.activeProcessorCount,
            "totalMb": Int(info.physicalMemory / 1_048_576),
            "density": Double(scale),
            "webview": "WKWebView",
            "app": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "",
        ]
    }

    /// on Android's scale (0 none, 1 light, 2 moderate, 3 severe, 4 critical): the game counts 2 and up as hot
    private static func thermal(_ state: ProcessInfo.ThermalState) -> Int {
        switch state {
        case .nominal: return 0
        case .fair: return 1
        case .serious: return 3
        case .critical: return 4
        @unknown default: return 0
        }
    }

    static func json(_ object: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
