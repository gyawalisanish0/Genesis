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

import os

from kivy.app import App
from kivy.lang import Builder
from kivy.uix.screenmanager import ScreenManager, FadeTransition

import app.services.display_service as display_service_module
import app.services.input_service   as input_service_module

from app.core.game_context import GameContext

_KV_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'kv')

# KV files loaded in dependency order (most-reused widgets first).
# Extend this list as new screens are added in later phases.
_KV_FILES = [
    'stub_screen.kv',
    'splash_screen.kv',
    'main_menu_screen.kv',
    # Phase 2
    'settings_screen.kv',
    # Phase 3
    'roster_screen.kv',
    # 'pre_battle_screen.kv',
    # 'battle_result_screen.kv',
    'battle_screen.kv',
]


class GenesisApp(App):
    """Root application — owns the ScreenManager and shared state."""

    game_context = GameContext()

    # Persisted settings — read/written by SettingsScreen
    settings: dict = {
        'music_volume': 0.75,
        'sfx_volume': 0.80,
        'mute_all': False,
        'reduce_animations': False,
        'show_damage_numbers': True,
        'timeline_zoom': 5,
        'battle_reminders': False,
        'new_content_alerts': True,
    }

    def build(self):
        # 1. Display first — sets immersive mode and reads safe-area insets.
        display_service_module.init()

        # 2. Input service — binds to Window touch/keyboard events.
        input_service_module.init()

        # 3. Load all KV layout files before instantiating any screens.
        for filename in _KV_FILES:
            Builder.load_file(os.path.join(_KV_DIR, filename))

        # 4. Import screen classes (must come after KV is loaded).
        from app.screens.stub_screen import StubScreen
        from app.screens.splash_screen import SplashScreen
        from app.screens.main_menu_screen import MainMenuScreen
        from app.screens.battle_screen import BattleScreen
        from app.screens.settings_screen import SettingsScreen
        from app.screens.roster_screen import RosterScreen

        # 5. Wire ScreenManager — first screen added becomes the start screen.
        sm = ScreenManager(transition=FadeTransition(duration=0.25))
        sm.add_widget(SplashScreen(name='splash'))
        sm.add_widget(MainMenuScreen(name='main_menu'))
        sm.add_widget(BattleScreen(name='battle'))

        # Stub placeholders for screens built in later phases
        sm.add_widget(StubScreen(name='pre_battle',    title_text='PRE-BATTLE'))
        sm.add_widget(RosterScreen(name='roster'))
        sm.add_widget(SettingsScreen(name='settings'))
        sm.add_widget(StubScreen(name='mastery_road',  title_text='MASTERY ROAD'))
        sm.add_widget(StubScreen(name='shop',          title_text='SHOP'))
        sm.add_widget(StubScreen(name='battle_result', title_text='BATTLE RESULT'))

        return sm


if __name__ == "__main__":
    GenesisApp().run()
