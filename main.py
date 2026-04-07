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
import sys
import traceback

from kivy.app import App
from kivy.lang import Builder
from kivy.logger import Logger
from kivy.properties import BooleanProperty
from kivy.uix.screenmanager import ScreenManager, NoTransition

import app.services.display_service as display_service_module
import app.services.input_service   as input_service_module

from app.core.game_context import GameContext


def _crash_log_path() -> str:
    """
    Return a writable path for the crash log.
    On Android 10+ /sdcard is blocked by scoped storage — use user_data_dir
    (the app's private files dir) which is always writable.
    On desktop fall back to the current working directory.
    """
    try:
        app = App.get_running_app()
        if app is not None:
            return os.path.join(app.user_data_dir, 'genesis_crash.log')
    except Exception:
        pass
    return os.path.join(os.path.dirname(__file__), 'genesis_crash.log')


def _install_crash_logger() -> None:
    """
    Write any uncaught Python exception to a writable crash log file
    so it can be read on-device without adb logcat.
    """
    _original = sys.excepthook

    def _hook(exc_type, exc_value, exc_tb):
        msg = "".join(traceback.format_exception(exc_type, exc_value, exc_tb))
        Logger.critical("GenesisApp: UNCAUGHT EXCEPTION\n%s", msg)
        try:
            with open(_crash_log_path(), 'w') as f:
                f.write(msg)
        except OSError:
            pass
        _original(exc_type, exc_value, exc_tb)

    sys.excepthook = _hook


_install_crash_logger()

_KV_DIR = os.path.join(os.path.dirname(__file__), 'assets', 'kv')

# Set GENESIS_DEBUG=1 in the environment to enable the in-app debug tools.
_DEBUG = os.environ.get('GENESIS_DEBUG', '').lower() in ('1', 'true', 'yes')

# KV files loaded in dependency order (most-reused widgets first).
_KV_FILES = [
    'stub_screen.kv',
    'splash_screen.kv',
    'main_menu_screen.kv',
    'settings_screen.kv',
    'roster_screen.kv',
    'pre_battle_screen.kv',
    'battle_screen.kv',
    'battle_result_screen.kv',
    'debug_screen.kv',
]


class GenesisApp(App):
    """Root application — owns the ScreenManager and shared state."""

    # Reactive property — accessible as `app.debug_mode` in KV files.
    debug_mode = BooleanProperty(_DEBUG)

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
        #    Wrapped so a pyjnius/API failure never crashes App.build().
        try:
            display_service_module.init()
        except Exception as exc:
            Logger.error("GenesisApp: display_service.init() failed: %s\n%s",
                         exc, traceback.format_exc())

        # 2. Input service — binds to Window touch/keyboard events.
        try:
            input_service_module.init()
        except Exception as exc:
            Logger.error("GenesisApp: input_service.init() failed: %s\n%s",
                         exc, traceback.format_exc())

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
        from app.screens.pre_battle_screen import PreBattleScreen
        from app.screens.battle_result_screen import BattleResultScreen
        from app.screens.debug_screen import DebugScreen

        # 5. Wire ScreenManager — first screen added becomes the start screen.
        sm = ScreenManager(transition=NoTransition())
        sm.add_widget(SplashScreen(name='splash'))
        sm.add_widget(MainMenuScreen(name='main_menu'))
        sm.add_widget(BattleScreen(name='battle'))
        sm.add_widget(PreBattleScreen(name='pre_battle'))
        sm.add_widget(RosterScreen(name='roster'))
        sm.add_widget(SettingsScreen(name='settings'))
        sm.add_widget(BattleResultScreen(name='battle_result'))
        sm.add_widget(DebugScreen(name='debug'))
        sm.add_widget(StubScreen(name='mastery_road', title_text='MASTERY ROAD'))
        sm.add_widget(StubScreen(name='shop',         title_text='SHOP'))

        return sm


if __name__ == "__main__":
    GenesisApp().run()
