"""
Entry point — launches the Kivy application.
No game logic lives here.
"""
# Config.set MUST come before any kivy.core.window or App import.
# 'auto' enables full-screen on mobile; on desktop it opens a normal window.
from kivy.config import Config
Config.set('graphics', 'fullscreen', 'auto')
Config.set('graphics', 'width', '360')
Config.set('graphics', 'height', '640')

from kivy.app import App

import app.services.display_service as display_service_module
import app.services.input_service   as input_service_module


class GenesisApp(App):
    def build(self):
        # 1. Display first — sets immersive mode and reads safe-area insets.
        #    Must precede input_service so Window is fully configured.
        display_service_module.init()

        # 2. Input service — binds to Window touch/keyboard events.
        input_service_module.init()

        # Screens and navigation will be wired here in Phase 2


if __name__ == "__main__":
    GenesisApp().run()
