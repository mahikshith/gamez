import Foundation
import WebKit

/// Serves the bundled game folder (the app's `game/`) on eggscape://localhost/... A custom scheme instead of file://
/// gives the page a stable origin, so its localStorage (the save) persists, and WebKit treats it like a normal site.
/// Nothing else is served: a path that leaves the folder or does not exist is a 404.
final class GameSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL

    /// The game is fully offline: the page may load only from this scheme and from data:/blob: URLs it makes itself,
    /// so nothing on the page can reach the network.
    private static let policy = "default-src \(GameConfig.scheme): data: blob: 'unsafe-inline' 'unsafe-eval'"

    init(root: URL) {
        self.root = root.standardizedFileURL
        super.init()
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        let inside = file.path.hasPrefix(root.path + "/")
        guard inside, let data = try? Data(contentsOf: file) else {
            let missing = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1",
                                          headerFields: ["Content-Type": "text/plain", "Content-Length": "0"])
            if let missing { urlSchemeTask.didReceive(missing) }
            urlSchemeTask.didReceive(Data())
            urlSchemeTask.didFinish()
            return
        }
        let headers = [
            "Content-Type": Self.mimeType(for: file.pathExtension),
            "Content-Length": String(data.count),
            "Cache-Control": "no-cache",
            "Content-Security-Policy": Self.policy,
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) else {
            urlSchemeTask.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // every answer above is sent at once, so there is never a load to stop
    }

    private static func mimeType(for ext: String) -> String {
        switch ext.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json": return "application/json"
        case "txt": return "text/plain; charset=utf-8"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "woff2": return "font/woff2"
        case "mp3": return "audio/mpeg"
        case "m4a": return "audio/mp4"
        case "wav": return "audio/wav"
        case "wasm": return "application/wasm"
        default: return "application/octet-stream"
        }
    }
}
