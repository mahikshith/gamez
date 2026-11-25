import UIKit
import WebKit

/// The game: one full-screen WKWebView showing the bundled page (game/index.html) through GameSchemeHandler, with the
/// window.EggApp bridge (Bridge.swift). The iOS counterpart of the Android shell's MainActivity.
final class GameViewController: UIViewController {
    private var webView: WKWebView?
    private let haptics = Haptics()
    private var trims = 0       // memory warnings, for the speed log
    private var renderGone = 0  // times the page's process died and the game was started again
    private var cures = 0       // fresh pages asked for by the slow-drawing watchdog (src/recover.js)
    private var lastSafe = ""
    private var refresh: Timer?

    override func loadView() {
        let root = UIView()
        root.backgroundColor = GameConfig.background
        view = root
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        UIDevice.current.isBatteryMonitoringEnabled = true
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(memoryWarning),
                           name: UIApplication.didReceiveMemoryWarningNotification, object: nil)
        center.addObserver(self, selector: #selector(becameActive),
                           name: UIApplication.didBecomeActiveNotification, object: nil)
        makeWebView()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        UIApplication.shared.isIdleTimerDisabled = true // the screen stays on while the game is up, as on Android
        haptics.prepare()
        pushSafe()
        if refresh == nil {
            // the battery, heat and power-saving facts deviceInfo() answers with (it has to answer at once)
            refresh = Timer.scheduledTimer(timeInterval: 5, target: self, selector: #selector(refreshTick),
                                           userInfo: nil, repeats: true)
        }
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        pushSafe()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        pushSafe()
    }

    // MARK: - the web view

    /// A new web view on the game page (also after its process died, or when the page asks for a fresh one).
    private func makeWebView() {
        if let old = webView {
            old.configuration.userContentController.removeScriptMessageHandler(forName: GameConfig.handlerName)
            old.navigationDelegate = nil
            old.stopLoading()
            old.removeFromSuperview()
            webView = nil
        }
        lastSafe = ""

        guard let root = Bundle.main.url(forResource: "game", withExtension: nil),
              FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            showMissingPage()
            return
        }

        let content = WKUserContentController()
        content.add(WeakMessageHandler(self), name: GameConfig.handlerName)
        content.addUserScript(WKUserScript(source: Bootstrap.source(stateJSON: bootState()),
                                           injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let config = WKWebViewConfiguration()
        config.userContentController = content
        config.setURLSchemeHandler(GameSchemeHandler(root: root), forURLScheme: GameConfig.scheme)
        config.websiteDataStore = .default() // the save (localStorage) lives here and survives app restarts
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = [] // the game's WebAudio may start without a tap
        config.preferences.javaScriptCanOpenWindowsAutomatically = false

        let web = WKWebView(frame: view.bounds, configuration: config)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false // the sky colour shows until the page's first frame, never a white flash
        web.backgroundColor = GameConfig.background
        web.scrollView.backgroundColor = GameConfig.background
        // a game screen: no scrolling, bouncing or zooming, edge to edge (the page reads the safe area itself)
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.bouncesZoom = false
        web.scrollView.minimumZoomScale = 1
        web.scrollView.maximumZoomScale = 1
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.pinchGestureRecognizer?.isEnabled = false
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        web.navigationDelegate = self
        #if DEBUG
        web.isInspectable = true // Safari > Develop on a Mac can inspect test builds
        #endif
        view.addSubview(web)
        webView = web
        web.load(URLRequest(url: GameConfig.startURL))
    }

    /// what the bridge knows before the page's first line runs
    private func bootState() -> String {
        let state: [String: Any] = [
            "dev": liveFacts(),
            "full": DeviceFacts.fixed(scale: traitCollection.displayScale > 0 ? traitCollection.displayScale : UIScreen.main.scale),
            "haptic": haptics.available ? 1 : 0,
            "stash": UserDefaults.standard.string(forKey: GameConfig.stashKey) ?? "",
        ]
        return DeviceFacts.json(state) ?? "{}"
    }

    private func liveFacts() -> [String: Any] {
        let hz = view.window?.windowScene?.screen.maximumFramesPerSecond ?? 60
        return DeviceFacts.live(trims: trims, renderGone: renderGone, cures: cures, hz: hz)
    }

    private func run(_ js: String) {
        webView?.evaluateJavaScript(js, completionHandler: nil)
    }

    /// The safe area in CSS px (window.__eggSafe, the same message the Android shell sends). WebKit also gives the
    /// page env(safe-area-inset-*); the game takes the larger of the two.
    private func pushSafe() {
        guard webView != nil else { return }
        let ins = view.window?.safeAreaInsets ?? view.safeAreaInsets
        let js = "window.__eggSafe={t:\(Int(ins.top.rounded())),b:\(Int(ins.bottom.rounded())),"
            + "l:\(Int(ins.left.rounded())),r:\(Int(ins.right.rounded()))};"
        guard js != lastSafe else { return }
        lastSafe = js
        run("(function(){" + js + "try{window.dispatchEvent(new Event('eggsafe'))}catch(e){}})()")
    }

    private func showMissingPage() {
        let label = UILabel()
        label.text = "No game page in this build.\nRun: node tools/build.mjs --target ios\nthen xtool dev again."
        label.numberOfLines = 0
        label.textAlignment = .center
        label.textColor = .white
        label.frame = view.bounds.insetBy(dx: 24, dy: 24)
        label.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(label)
    }

    // MARK: - the app's own events

    @objc private func memoryWarning() {
        // the phone is short of memory: the page gives back every picture the screen in front does not need
        // (main.js trimPictures; 15 is Android's "running critical")
        trims += 1
        run("window.__eggTrim&&window.__eggTrim(15)")
        refreshTick()
    }

    @objc private func becameActive() {
        UIApplication.shared.isIdleTimerDisabled = true
        lastSafe = ""
        pushSafe()
        refreshTick()
    }

    @objc private func refreshTick() {
        guard let json = DeviceFacts.json(["dev": liveFacts()]) else { return }
        run("window.__eggIOS&&window.__eggIOS(" + json + ")")
    }

    // MARK: - what the page asks for

    private func shareLog(name: String, text: String) {
        guard presentedViewController == nil else { return }
        let safeName = name.range(of: "^[A-Za-z0-9._-]{1,80}$", options: .regularExpression) != nil ? name : "eggscape-log.txt"
        let body = text.count > 2_000_000 ? String(text.suffix(2_000_000)) : text
        let file = FileManager.default.temporaryDirectory.appendingPathComponent(safeName)
        do {
            try body.write(to: file, atomically: true, encoding: .utf8)
        } catch {
            return
        }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        if let pop = sheet.popoverPresentationController { // iPad: the sheet needs an anchor
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
            pop.permittedArrowDirections = []
        }
        present(sheet, animated: true)
    }

    /// The slow-drawing watchdog's rungs 2 and 3: keep the page's save and notes (handed back by unstash) and start
    /// a fresh web view, which gets a new page process. iOS cannot restart an app, so both rungs do the same.
    private func recover(keep: String) {
        UserDefaults.standard.set(keep, forKey: GameConfig.stashKey)
        cures += 1
        DispatchQueue.main.async { [weak self] in
            self?.makeWebView()
        }
    }
}

// MARK: - WKScriptMessageHandler

extension GameViewController: WKScriptMessageHandler {
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame,
              let body = message.body as? [String: Any],
              let fn = body["fn"] as? String else { return }
        switch fn {
        case "vibrate":
            haptics.pulse(ms: (body["ms"] as? NSNumber)?.intValue ?? 0)
        case "pattern":
            haptics.pattern(body["csv"] as? String ?? "")
        case "share":
            shareLog(name: body["name"] as? String ?? "", text: body["text"] as? String ?? "")
        case "recover":
            recover(keep: body["keep"] as? String ?? "")
        case "unstash":
            UserDefaults.standard.removeObject(forKey: GameConfig.stashKey)
        default:
            break
        }
    }
}

// MARK: - WKNavigationDelegate

extension GameViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // the web view never leaves the game: a web link the player tapped opens in Safari, anything else is dropped
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel)
            return
        }
        if scheme == GameConfig.scheme || scheme == "about" || scheme == "data" || scheme == "blob" {
            decisionHandler(.allow)
            return
        }
        if (scheme == "https" || scheme == "http") && navigationAction.navigationType == .linkActivated {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        lastSafe = ""
        pushSafe()
    }

    /// iOS ended the page's process (out of memory, or a crash): a fresh web view starts the game again from its save,
    /// instead of leaving a blank screen
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        renderGone += 1
        DispatchQueue.main.async { [weak self] in
            self?.makeWebView()
        }
    }
}

/// WKUserContentController keeps its handlers strongly; this keeps the controller from holding itself.
private final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
        super.init()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}
