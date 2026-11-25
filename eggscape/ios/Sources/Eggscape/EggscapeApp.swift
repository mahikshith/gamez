import AVFoundation
import SwiftUI

@main
struct EggscapeApp: App {
    init() {
        // Sound like a game: the game mixes with the player's own music, and the ring/silent switch mutes it.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.ambient, mode: .default, options: [])
        try? session.setActive(true)
    }

    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
                .background(Color(red: 0x42 / 255.0, green: 0x8a / 255.0, blue: 0xbe / 255.0))
        }
    }
}

/// The game's full-screen web view (GameViewController) inside the SwiftUI window.
struct GameView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> GameViewController {
        GameViewController()
    }

    func updateUIViewController(_ controller: GameViewController, context: Context) {}
}
