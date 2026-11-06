import AppKit

/// Entry point. Pawprint is a menu bar ("accessory") app: no Dock icon and no
/// main window — just the see-through cat overlay and the 🐾 menu bar item.
@main
enum PawprintMain {
    // Kept here so the delegate lives as long as the app (NSApplication's
    // `delegate` is a weak reference).
    static let delegate = AppDelegate()

    static func main() {
        let app = NSApplication.shared
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var overlay: OverlayController!
    private var statusItem: NSStatusItem!
    private let hideItem = NSMenuItem(title: "Hide Cats", action: #selector(AppDelegate.toggleHidden), keyEquivalent: "")
    private let pauseItem = NSMenuItem(title: "Pause Cats", action: #selector(AppDelegate.togglePaused), keyEquivalent: "")

    func applicationDidFinishLaunching(_ notification: Notification) {
        overlay = OverlayController()
        overlay.show()
        setUpStatusItem()
    }

    private func setUpStatusItem() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            if let image = NSImage(systemSymbolName: "pawprint.fill", accessibilityDescription: "Pawprint") {
                image.isTemplate = true
                button.image = image
            } else {
                button.title = "🐾"
            }
        }

        let menu = NSMenu()
        menu.delegate = self

        let openItem = NSMenuItem(title: "Open Pawprint Panel", action: #selector(openPanel), keyEquivalent: "")
        openItem.target = self
        menu.addItem(openItem)
        menu.addItem(.separator())

        hideItem.target = self
        pauseItem.target = self
        menu.addItem(hideItem)
        menu.addItem(pauseItem)
        menu.addItem(.separator())

        let quitItem = NSMenuItem(title: "Quit Pawprint", action: #selector(quit), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
    }

    // Tick the Hide/Pause items to match the current settings (which can
    // also be changed from the panel's Settings tab).
    func menuWillOpen(_ menu: NSMenu) {
        overlay.fetchStatus { [weak self] hidden, paused in
            self?.hideItem.state = hidden ? .on : .off
            self?.pauseItem.state = paused ? .on : .off
        }
    }

    @objc private func openPanel() { overlay.openPanel() }
    @objc private func toggleHidden() { overlay.toggleHidden() }
    @objc private func togglePaused() { overlay.togglePaused() }
    @objc private func quit() { NSApp.terminate(nil) }
}
