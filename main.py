"""
Entry point — launches the Kivy application.
No game logic lives here.
"""
from kivy.app import App

import app.services.input_service as input_service_module


class GenesisApp(App):
    def build(self):
        # Initialise the global input handler — must happen after the Window
        # exists (i.e. inside build, not at module level).
        input_service_module.init()
        # Screens and navigation will be wired here in Phase 2


if __name__ == "__main__":
    GenesisApp().run()
