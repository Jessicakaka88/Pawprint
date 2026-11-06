import AppKit
import WebKit

/// A borderless panel that can still take clicks and keyboard focus (for the
/// control panel's dropdown) without activating the app.
final class OverlayWindow: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }
}

/// Takes the very first click even while Pawprint isn't the active app, so a
/// cat responds to a pat straight away instead of the click being swallowed.
final class PawprintWebView: WKWebView {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// Owns the see-through overlay that covers the desktop and the web page
/// (index.html + js/ + css/ + assets/ from the repository root) that draws the
/// cats in it. The page's half of this lives in js/native.js.
///
/// How clicks work: the overlay normally lets every click pass through to the
/// apps underneath (`ignoresMouseEvents = true`). The page reports the
/// rectangles of everything clickable (cats, their buttons and boards, toys,
/// decor, the control panel), and this controller checks the mouse against
/// them 60 times a second, catching clicks only while the mouse is over one.
final class OverlayController: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    private let window: OverlayWindow
    private let webView: PawprintWebView

    private var hitRects: [CGRect] = []
    private var lastMouse: CGPoint?
    private var lastWindowsJSON = ""
    private var timers: [Timer] = []

    override init() {
        let frame = OverlayController.overlayFrame()

        let window = OverlayWindow(
            contentRect: frame,
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = false
        window.level = .floating // above ordinary app windows
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        window.ignoresMouseEvents = true
        window.isMovable = false
        window.hidesOnDeactivate = false
        window.isReleasedWhenClosed = false
        window.acceptsMouseMovedEvents = true
        window.becomesKeyOnlyIfNeeded = true

        // Tell the page it's running in the app, and hand it the progress
        // saved by the last run (see js/streak.js).
        let contentController = WKUserContentController()
        let savedState = Persistence.load() ?? ""
        let bootstrap = "window.PAWPRINT_NATIVE = true; window.PAWPRINT_SAVED_STATE = \(OverlayController.jsString(savedState));"
        contentController.addUserScript(WKUserScript(source: bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let config = WKWebViewConfiguration()
        config.userContentController = contentController

        let webView = PawprintWebView(frame: NSRect(origin: .zero, size: frame.size), configuration: config)
        webView.setValue(false, forKey: "drawsBackground") // see-through page background
        webView.underPageBackgroundColor = .clear
        webView.autoresizingMask = [.width, .height]
        window.contentView = webView

        self.window = window
        self.webView = webView
        super.init()

        contentController.add(self, name: "pawprint")
        webView.uiDelegate = self
        webView.navigationDelegate = self

        if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
        } else {
            NSLog("Pawprint: index.html is missing from the app bundle")
        }

        NotificationCenter.default.addObserver(
            self, selector: #selector(screensChanged),
            name: NSApplication.didChangeScreenParametersNotification, object: nil
        )
    }

    func show() {
        window.orderFrontRegardless()
        schedule(every: 1.0 / 60.0) { [weak self] in self?.trackMouse() }
        schedule(every: 0.25) { [weak self] in self?.refreshWindows() }
    }

    private func schedule(every interval: TimeInterval, _ block: @escaping () -> Void) {
        let timer = Timer(timeInterval: interval, repeats: true) { _ in block() }
        // .common keeps it running while a menu is open or something is being dragged.
        RunLoop.main.add(timer, forMode: .common)
        timers.append(timer)
    }

    // MARK: - Geometry

    /// The overlay covers the main display minus the menu bar and the Dock, so
    /// the cats' floor sits just above the Dock.
    private static func overlayFrame() -> NSRect {
        let screen = NSScreen.screens.first ?? NSScreen.main
        return screen?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
    }

    @objc private func screensChanged() {
        window.setFrame(OverlayController.overlayFrame(), display: true)
        lastWindowsJSON = ""
    }

    /// Converts a point in AppKit screen coordinates (origin bottom-left) to
    /// page coordinates (origin top-left of the overlay).
    private func pagePoint(fromScreen p: NSPoint) -> CGPoint {
        let frame = window.frame
        return CGPoint(x: p.x - frame.minX, y: frame.maxY - p.y)
    }

    // MARK: - Mouse: click-through and hover

    private func trackMouse() {
        let p = pagePoint(fromScreen: NSEvent.mouseLocation)

        if p != lastMouse {
            lastMouse = p
            run("window.PawprintNative && PawprintNative.mouse(\(Double(p.x)), \(Double(p.y)))")
        }

        // Never flip mid-click: a drag that started on a cat keeps the
        // overlay catching events until the button is released, and a drag
        // that started in another app keeps passing through.
        guard NSEvent.pressedMouseButtons == 0 else { return }
        let overSomethingClickable = hitRects.contains { $0.contains(p) }
        if window.ignoresMouseEvents == overSomethingClickable {
            window.ignoresMouseEvents = !overSomethingClickable
        }
    }

    // MARK: - Real windows for the cats to perch on

    /// Sends the page every ordinary app window whose top edge is on screen
    /// and mostly uncovered, so cats can climb up and sit on it. Window
    /// positions don't need Screen Recording permission (only titles do).
    private func refreshWindows() {
        guard let info = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
                as? [[String: Any]] else { return }

        let myPID = ProcessInfo.processInfo.processIdentifier
        let primaryHeight = NSScreen.screens.first?.frame.height ?? 0
        let frame = window.frame
        // The overlay's top-left corner in window-list coordinates (origin
        // top-left of the main display, y pointing down).
        let originX = frame.minX
        let originY = primaryHeight - frame.maxY

        var inFront: [CGRect] = []
        var perches: [[String: Any]] = []

        for entry in info { // front-to-back order
            guard (entry[kCGWindowLayer as String] as? Int) == 0,
                  let boundsDict = entry[kCGWindowBounds as String] as? NSDictionary,
                  let bounds = CGRect(dictionaryRepresentation: boundsDict as CFDictionary)
            else { continue }
            let pid = entry[kCGWindowOwnerPID as String] as? Int32 ?? 0
            let alpha = entry[kCGWindowAlpha as String] as? Double ?? 1
            guard pid != myPID, alpha > 0.1 else { continue }
            defer { inFront.append(bounds) }

            guard bounds.width >= 160, bounds.height >= 100,
                  let number = entry[kCGWindowNumber as String] as? Int
            else { continue }

            let x = bounds.minX - originX
            let y = bounds.minY - originY
            // Skip windows whose top is too close to the top of the screen for
            // a cat to fit above it, below the floor, or off this display.
            guard y >= 90, y < frame.height - 80, x + bounds.width > 40, x < frame.width - 40 else { continue }
            guard OverlayController.coveredFraction(ofTopEdgeOf: bounds, by: inFront) < 0.4 else { continue }

            perches.append(["id": number, "x": x, "y": y, "w": bounds.width, "h": bounds.height])
        }

        guard let data = try? JSONSerialization.data(withJSONObject: perches),
              let json = String(data: data, encoding: .utf8),
              json != lastWindowsJSON else { return }
        lastWindowsJSON = json
        run("window.PawprintNative && PawprintNative.windows(\(json))")
    }

    /// How much of a window's top edge is hidden behind windows in front of it (0...1).
    private static func coveredFraction(ofTopEdgeOf rect: CGRect, by front: [CGRect]) -> CGFloat {
        let edgeY = rect.minY + 2
        var spans: [(CGFloat, CGFloat)] = front.compactMap { f in
            guard f.minY <= edgeY, f.maxY >= edgeY else { return nil }
            let lo = max(rect.minX, f.minX), hi = min(rect.maxX, f.maxX)
            return hi > lo ? (lo, hi) : nil
        }
        spans.sort { $0.0 < $1.0 }
        var covered: CGFloat = 0
        var current: (CGFloat, CGFloat)?
        for span in spans {
            if let c = current, span.0 <= c.1 {
                current = (c.0, max(c.1, span.1))
            } else {
                if let c = current { covered += c.1 - c.0 }
                current = span
            }
        }
        if let c = current { covered += c.1 - c.0 }
        return rect.width > 0 ? covered / rect.width : 1
    }

    // MARK: - Menu bar commands

    func openPanel() {
        run("PawprintNative.openPanel()")
    }

    func toggleHidden() {
        run("PawprintNative.toggleHidden()")
    }

    func togglePaused() {
        run("PawprintNative.togglePaused()")
    }

    func fetchStatus(_ completion: @escaping (_ hidden: Bool, _ paused: Bool) -> Void) {
        webView.evaluateJavaScript("PawprintNative.status()") { result, _ in
            let status = result as? [String: Any]
            completion((status?["hidden"] as? Bool) ?? false, (status?["paused"] as? Bool) ?? false)
        }
    }

    private func run(_ script: String) {
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    // MARK: - Messages from the page

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "hitRects":
            guard let json = body["rects"] as? String,
                  let data = json.data(using: .utf8),
                  let list = try? JSONSerialization.jsonObject(with: data) as? [[Double]]
            else { return }
            hitRects = list.compactMap { r in
                r.count == 4 ? CGRect(x: r[0], y: r[1], width: r[2], height: r[3]) : nil
            }
        case "save":
            if let state = body["state"] as? String { Persistence.save(state) }
        case "ready":
            lastWindowsJSON = ""
            refreshWindows()
        default:
            break
        }
    }

    // MARK: - JavaScript alert/confirm (used by "Reset progress")

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.runModal()
        completionHandler()
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        completionHandler(alert.runModal() == .alertFirstButtonReturn)
    }

    // MARK: - Helpers

    /// A JavaScript string literal for `s` (JSON strings are valid JS strings).
    private static func jsString(_ s: String) -> String {
        guard let data = try? JSONEncoder().encode(s), let literal = String(data: data, encoding: .utf8) else { return "\"\"" }
        return literal
    }
}

/// Saves progress (points, unlocks, settings…) to
/// ~/Library/Application Support/Pawprint/state.json.
enum Persistence {
    private static var fileURL: URL? {
        guard let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else { return nil }
        return support.appendingPathComponent("Pawprint", isDirectory: true).appendingPathComponent("state.json")
    }

    static func load() -> String? {
        guard let url = fileURL else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }

    static func save(_ json: String) {
        guard let url = fileURL else { return }
        do {
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try json.write(to: url, atomically: true, encoding: .utf8)
        } catch {
            NSLog("Pawprint: couldn't save progress: \(error)")
        }
    }
}
