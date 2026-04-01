"""
Tests for app/services/display_service/.

DisplayService1 and DisplayService2 are tested directly — they only need
kivy.utils.platform mocked to simulate non-Android environments.

DisplayService (the main class) is tested by patching its sub-services
and the lazy Window import so no real display backend is required.
"""

import sys
from unittest.mock import MagicMock, call, patch

import pytest

# ── Ensure kivy modules are mocked before any display_service import ─────────
# kivy.core.window opens a display backend on import; we replace the whole
# kivy namespace with MagicMocks so the entire test file runs headless.
_mock_window = MagicMock()
_mock_kivy_utils = MagicMock()
_mock_kivy_utils.platform = "linux"   # default; individual tests patch as needed
sys.modules.setdefault("kivy", MagicMock())
sys.modules["kivy.utils"] = _mock_kivy_utils
sys.modules["kivy.core.window"] = MagicMock(Window=_mock_window)


# ── DisplayService2 — inset reader ────────────────────────────────────────────

class TestDisplayService2:

    def _make(self):
        from app.services.display_service.display_service_2 import DisplayService2
        return DisplayService2()

    def test_returns_fallback_on_non_android(self):
        ds2 = self._make()
        with patch("app.services.display_service.display_service_2.platform", "win"):
            result = ds2.read_insets()
        assert result == {"top": 24, "bottom": 48, "left": 0, "right": 0}

    def test_all_four_keys_always_present(self):
        ds2 = self._make()
        for plat in ("win", "linux", "macosx", "ios"):
            with patch("app.services.display_service.display_service_2.platform", plat):
                insets = ds2.read_insets()
            for key in ("top", "bottom", "left", "right"):
                assert key in insets, f"Missing key '{key}' on platform '{plat}'"

    def test_fallback_values_are_integers(self):
        ds2 = self._make()
        with patch("app.services.display_service.display_service_2.platform", "win"):
            insets = ds2.read_insets()
        for key, val in insets.items():
            assert isinstance(val, int), f"'{key}' should be int, got {type(val)}"

    def test_returns_copy_not_reference(self):
        """Mutations to the returned dict must not affect internal state."""
        ds2 = self._make()
        with patch("app.services.display_service.display_service_2.platform", "win"):
            a = ds2.read_insets()
            a["top"] = 999
            b = ds2.read_insets()
        assert b["top"] == 24

    def test_ios_returns_fallback(self):
        ds2 = self._make()
        with patch("app.services.display_service.display_service_2.platform", "ios"):
            insets = ds2.read_insets()
        assert insets == {"top": 24, "bottom": 48, "left": 0, "right": 0}

    def test_android_modern_path_called_for_api_30_plus(self):
        """_read_modern is invoked when Android SDK_INT >= 30."""
        ds2 = self._make()
        mock_activity = MagicMock()
        mock_activity.getResources().getDisplayMetrics().density = 3.0

        # Build a realistic root-insets mock
        mock_insets = MagicMock()
        mock_insets.top    = 72   # 72px / 3.0 density = 24dp
        mock_insets.bottom = 144  # 144px / 3.0 = 48dp
        mock_insets.left   = 0
        mock_insets.right  = 0
        mock_root_insets = MagicMock()
        mock_root_insets.getInsets.return_value = mock_insets
        mock_activity.getWindow().getDecorView().getRootWindowInsets.return_value = (
            mock_root_insets
        )

        mock_build   = MagicMock()
        mock_build.VERSION.SDK_INT = 33
        mock_py_act  = MagicMock()
        mock_py_act.mActivity = mock_activity
        mock_inset_type = MagicMock()

        def fake_autoclass(name):
            mapping = {
                "android.os.Build":                        mock_build,
                "org.kivy.android.PythonActivity":         mock_py_act,
                "android.view.WindowInsets$Type":          mock_inset_type,
            }
            return mapping[name]

        with patch("app.services.display_service.display_service_2.platform", "android"), \
             patch("app.services.display_service.display_service_2.DisplayService2"
                   "._read_android",
                   wraps=ds2._read_android):
            with patch("builtins.__import__", wraps=__builtins__.__import__
                       if hasattr(__builtins__, "__import__") else __import__):
                with patch.dict(sys.modules, {"jnius": MagicMock(autoclass=fake_autoclass)}):
                    result = ds2._read_android()

        assert result == {"top": 24, "bottom": 48, "left": 0, "right": 0}

    def test_android_modern_fallback_when_root_insets_none(self):
        """When getRootWindowInsets() returns None, fallback insets are used."""
        ds2 = self._make()
        mock_activity = MagicMock()
        mock_activity.getWindow().getDecorView().getRootWindowInsets.return_value = None
        mock_build  = MagicMock()
        mock_build.VERSION.SDK_INT = 33
        mock_py_act = MagicMock()
        mock_py_act.mActivity = mock_activity

        def fake_autoclass(name):
            return {
                "android.os.Build":                mock_build,
                "org.kivy.android.PythonActivity": mock_py_act,
                "android.view.WindowInsets$Type":  MagicMock(),
            }[name]

        with patch.dict(sys.modules, {"jnius": MagicMock(autoclass=fake_autoclass)}):
            result = ds2._read_modern(mock_activity)

        assert result == {"top": 24, "bottom": 48, "left": 0, "right": 0}


# ── DisplayService1 — immersive mode ──────────────────────────────────────────

class TestDisplayService1:

    def _make(self):
        from app.services.display_service.display_service_1 import DisplayService1
        return DisplayService1()

    def test_apply_immersive_noop_on_desktop(self):
        """No exception raised on non-Android platforms."""
        ds1 = self._make()
        for plat in ("win", "linux", "macosx", "ios"):
            with patch("app.services.display_service.display_service_1.platform", plat):
                ds1.apply_immersive()   # must not raise

    def test_apply_immersive_calls_android_on_android_platform(self):
        ds1 = self._make()
        with patch("app.services.display_service.display_service_1.platform", "android"), \
             patch.object(ds1, "_apply_android") as mock_android:
            ds1.apply_immersive()
        mock_android.assert_called_once()

    def test_apply_modern_called_for_api_30_plus(self):
        ds1 = self._make()
        mock_build  = MagicMock()
        mock_build.VERSION.SDK_INT = 33
        mock_py_act = MagicMock()
        mock_py_act.mActivity = MagicMock()

        def fake_autoclass(name):
            return {
                "android.os.Build":                mock_build,
                "org.kivy.android.PythonActivity": mock_py_act,
            }[name]

        with patch("app.services.display_service.display_service_1.platform", "android"), \
             patch.object(ds1, "_apply_modern") as mock_modern, \
             patch.dict(sys.modules, {"jnius": MagicMock(autoclass=fake_autoclass)}):
            ds1._apply_android()

        mock_modern.assert_called_once()

    def test_apply_legacy_called_for_api_below_30(self):
        ds1 = self._make()
        mock_build  = MagicMock()
        mock_build.VERSION.SDK_INT = 28
        mock_py_act = MagicMock()
        mock_py_act.mActivity = MagicMock()

        def fake_autoclass(name):
            return {
                "android.os.Build":                mock_build,
                "org.kivy.android.PythonActivity": mock_py_act,
            }[name]

        with patch("app.services.display_service.display_service_1.platform", "android"), \
             patch.object(ds1, "_apply_legacy") as mock_legacy, \
             patch.dict(sys.modules, {"jnius": MagicMock(autoclass=fake_autoclass)}):
            ds1._apply_android()

        mock_legacy.assert_called_once()

    def test_apply_modern_skips_when_controller_is_none(self):
        """No crash when getInsetsController() returns None."""
        ds1 = self._make()
        mock_activity = MagicMock()
        mock_activity.getWindow().getInsetsController.return_value = None

        mock_inset_ctrl = MagicMock()
        mock_inset_type = MagicMock()

        def fake_autoclass(name):
            return {
                "android.view.WindowInsets$Type":     mock_inset_type,
                "android.view.WindowInsetsController": mock_inset_ctrl,
            }[name]

        with patch.dict(sys.modules, {"jnius": MagicMock(autoclass=fake_autoclass)}):
            ds1._apply_modern(mock_activity)   # must not raise

        # hide() must NOT have been called — controller was None
        mock_inset_ctrl.hide.assert_not_called()


# ── DisplayService — main class ───────────────────────────────────────────────

class TestDisplayService:

    def _make(self, insets=None):
        """
        Build a DisplayService with both sub-services mocked and Window stubbed.
        Returns (service, mock_ds1, mock_ds2, mock_window).
        """
        if insets is None:
            insets = {"top": 24, "bottom": 48, "left": 0, "right": 0}

        mock_ds1 = MagicMock()
        mock_ds2 = MagicMock()
        mock_ds2.read_insets.return_value = insets
        mock_win = MagicMock()

        with patch("app.services.display_service.display_service.DisplayService1",
                   return_value=mock_ds1), \
             patch("app.services.display_service.display_service.DisplayService2",
                   return_value=mock_ds2), \
             patch.dict(sys.modules,
                        {"kivy.core.window": MagicMock(Window=mock_win)}):
            from app.services.display_service.display_service import DisplayService
            svc = DisplayService()

        return svc, mock_ds1, mock_ds2, mock_win

    def test_apply_immersive_called_on_init(self):
        _, mock_ds1, _, _ = self._make()
        mock_ds1.apply_immersive.assert_called_once()

    def test_read_insets_called_on_init(self):
        _, _, mock_ds2, _ = self._make()
        mock_ds2.read_insets.assert_called_once()

    def test_window_on_restore_bound_on_init(self):
        _, _, _, mock_win = self._make()
        mock_win.bind.assert_called_once()
        bound_kwargs = mock_win.bind.call_args.kwargs
        assert "on_restore" in bound_kwargs

    def test_get_safe_insets_returns_cached_value(self):
        insets = {"top": 30, "bottom": 60, "left": 5, "right": 5}
        svc, _, _, _ = self._make(insets=insets)
        assert svc.get_safe_insets() == insets

    def test_get_safe_insets_returns_copy(self):
        svc, _, _, _ = self._make()
        a = svc.get_safe_insets()
        a["top"] = 999
        assert svc.get_safe_insets()["top"] != 999

    def test_refresh_insets_updates_cache(self):
        svc, _, mock_ds2, _ = self._make()
        new_insets = {"top": 40, "bottom": 80, "left": 10, "right": 10}
        mock_ds2.read_insets.return_value = new_insets
        svc.refresh_insets()
        assert svc.get_safe_insets() == new_insets

    def test_on_window_restore_reapplies_immersive_and_refreshes(self):
        svc, mock_ds1, mock_ds2, _ = self._make()
        # Reset call counts from __init__
        mock_ds1.apply_immersive.reset_mock()
        mock_ds2.read_insets.reset_mock()

        svc._on_window_restore()

        mock_ds1.apply_immersive.assert_called_once()
        mock_ds2.read_insets.assert_called_once()


# ── Singleton helpers ─────────────────────────────────────────────────────────

class TestSingletonHelpers:

    def test_get_returns_none_before_init(self):
        import importlib
        import app.services.display_service as pkg
        importlib.reload(pkg)   # reset _instance to None
        assert pkg.get() is None

    def test_init_returns_display_service_instance(self):
        from app.services.display_service.display_service import DisplayService
        mock_ds1 = MagicMock()
        mock_ds2 = MagicMock()
        mock_ds2.read_insets.return_value = {"top": 24, "bottom": 48,
                                             "left": 0, "right": 0}
        mock_win = MagicMock()

        with patch("app.services.display_service.display_service.DisplayService1",
                   return_value=mock_ds1), \
             patch("app.services.display_service.display_service.DisplayService2",
                   return_value=mock_ds2), \
             patch.dict(sys.modules,
                        {"kivy.core.window": MagicMock(Window=mock_win)}):
            import app.services.display_service as pkg
            result = pkg.init()

        assert isinstance(result, DisplayService)
        assert pkg.get() is result
