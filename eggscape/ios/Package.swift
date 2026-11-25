// swift-tools-version: 6.0

import PackageDescription

// Eggscape for iPhone: the web game in a full-screen WKWebView, built and installed with xtool (docs/ios-test.md).
// xtool turns the one library product into the app; xtool.yml names the bundle ID, Info.plist, icon and the game page.
let package = Package(
    name: "Eggscape",
    platforms: [
        .iOS(.v17),
    ],
    products: [
        .library(
            name: "Eggscape",
            targets: ["Eggscape"]
        ),
    ],
    targets: [
        .target(
            name: "Eggscape"
        ),
    ],
    // plain UIKit + WebKit code; the Swift 5 language mode keeps SDK concurrency annotations from failing the build
    swiftLanguageModes: [.v5]
)
