# Full-Screen & 1080p Implementation Plan

## Goal

Every Genesis screen runs **edge-to-edge immersive** at 1080 × 1920 px (Full
HD portrait). System bars (status bar, navigation bar) are hidden. Safe-area
insets are read dynamically so interactive content never overlaps with cameras,
notches, or gesture handles.

---

## What Is Already Done

| Item | Location | Status |
|---|---|---|
| `Config.set fullscreen auto` | `main.py` top | ✅ Done |
| `fullscreen = 1` in buildozer | `buildozer.spec` | ✅ Done |
| CLAUDE.md Display rules | `CLAUDE.md` | ✅ Done |
| Design system canvas updated | `docs/ui/00_design_system.md` | ✅ Done |
| All screen docs reference runtime insets | `docs/ui/01_*.md … 10_*.md` | ✅ Done |

---

## What Still Needs to Be Built

### 1. `app/services/display_service.py`

The **single source of truth** for full-screen setup and safe-area insets.
Called once in `main.py`; its singleton is queried by screens and components
for dynamic padding.

#### Public API

```python
def init() -> DisplayService: ...   # call once in App.build()
def get()  -> DisplayService: ...   # call anywhere

class DisplayService:
    def get_safe_insets(self) -> dict:
        # returns {"top": int, "bottom": int, "left": int, "right": int}
        # values are in dp, read from device at runtime
        ...

    def apply_immersive_mode(self) -> None:
        # sets Android immersive sticky flags or iOS equivalent
        # no-op on desktop
        ...
```

#### Responsibilities

- Set Android immersive sticky mode (one-time, on first `init()` call)
- Re-apply immersive mode when focus returns (Android re-shows bars on
  certain interactions — bind to `Window.on_restore`)
- Read safe-area inset values from the platform and convert to dp
- Expose `get_safe_insets()` so all layout code has a single source

#### Non-responsibilities

- **Never** called from `core/`, `utils/`, or `components/` — only screens
  call `get_safe_insets()` to set their root layout padding
- Does not manage orientation — `buildozer.spec` locks portrait

---

### 2. Android Immersive Mode (inside `display_service.py`)

Two code paths depending on Android API level, both guarded by platform check:

#### API ≥ 30 — WindowInsetsController (modern)

```python
from kivy.utils import platform
if platform == 'android':
    from jnius import autoclass
    activity = autoclass('org.kivy.android.PythonActivity').mActivity
    Build    = autoclass('android.os.Build')
    if Build.VERSION.SDK_INT >= 30:
        window     = activity.getWindow()
        controller = window.getInsetsController()
        if controller:
            InsetType  = autoclass('android.view.WindowInsets$Type')
            InsetCtrl  = autoclass('android.view.WindowInsetsController')
            controller.hide(
                InsetType.statusBars() | InsetType.navigationBars()
            )
            controller.setSystemBarsBehavior(
                InsetCtrl.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            )
```

#### API < 30 — SystemUiVisibility flags (legacy)

```python
    else:
        View       = autoclass('android.view.View')
        decorView  = activity.getWindow().getDecorView()
        flags = (
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        )
        decorView.setSystemUiVisibility(flags)
```

---

### 3. Reading Safe-Area Insets (inside `display_service.py`)

#### Android API ≥ 30

```python
def _read_android_insets_modern(self) -> dict:
    activity   = autoclass('org.kivy.android.PythonActivity').mActivity
    InsetType  = autoclass('android.view.WindowInsets$Type')
    rootInsets = activity.getWindow().getDecorView().getRootWindowInsets()
    if rootInsets is None:
        return self._fallback_insets()
    insets = rootInsets.getInsets(InsetType.systemBars())
    density = activity.getResources().getDisplayMetrics().density
    return {
        "top":    round(insets.top    / density),
        "bottom": round(insets.bottom / density),
        "left":   round(insets.left   / density),
        "right":  round(insets.right  / density),
    }
```

#### Android API < 30

```python
def _read_android_insets_legacy(self) -> dict:
    activity  = autoclass('org.kivy.android.PythonActivity').mActivity
    density   = activity.getResources().getDisplayMetrics().density
    decorView = activity.getWindow().getDecorView()
    rect      = autoclass('android.graphics.Rect')()
    decorView.getWindowVisibleDisplayFrame(rect)
    screen_h  = activity.getResources().getDisplayMetrics().heightPixels
    return {
        "top":    round(rect.top    / density),
        "bottom": round((screen_h - rect.bottom) / density),
        "left":   round(rect.left   / density),
        "right":  0,
    }
```

#### Fallback (desktop / unresolvable)

```python
def _fallback_insets(self) -> dict:
    return {"top": 24, "bottom": 48, "left": 0, "right": 0}
```

---

### 4. How Screens Consume Insets

Each screen's root widget sets its padding from `display_service` in its
`on_kv_post` or `__init__`:

```python
# In a Screen class (app/screens/battle_screen.py)
from app.services.display_service import get as get_display

class BattleScreen(Screen):
    def on_kv_post(self, base_widget):
        insets = get_display().get_safe_insets()
        self.ids.root_layout.padding = [
            insets["left"],
            insets["bottom"],
            insets["right"],
            insets["top"],
        ]
```

The `.kv` file sets the layout background to bleed to true device edges;
Python only sets the inner padding so content avoids the unsafe zone.

---

### 5. Asset Pipeline — 1080p / 3× Primary

All artwork is sliced and exported at three density scales:

```
assets/images/
├── 1x/          # mdpi  — 360×640 reference  (1 dp = 1 px)
├── 2x/          # xhdpi — 720×1280           (1 dp = 2 px)
└── 3x/          # xxhdpi — 1080×1920         (1 dp = 3 px)  ← primary
```

| Density | Scale | Resolution |
|---|---|---|
| mdpi (1×) | 1.0 | 360 × 640 px |
| xhdpi (2×) | 2.0 | 720 × 1280 px |
| **xxhdpi (3×)** | **3.0** | **1080 × 1920 px** ← design here |
| xxxhdpi (4×) | 4.0 | 1440 × 2560 px — not required initially |

**Rules:**
- Design all UI art at 1080 × 1920 px
- Export 3× as the delivery asset (primary)
- Downscale by 2 for 2× (720 × 1280); by 3 for 1× (360 × 640)
- `data_service` does not handle density selection — Kivy's image loader picks
  the nearest match based on `Window.density` at runtime (requires atlas setup
  or explicit path selection in Phase 3)

---

### 6. `main.py` Init Order

The correct startup sequence after this plan is implemented:

```python
# 1. Kivy Config FIRST — before any Window or App import
from kivy.config import Config
Config.set('graphics', 'fullscreen', 'auto')
Config.set('graphics', 'width',  '360')
Config.set('graphics', 'height', '640')

# 2. App import
from kivy.app import App

# 3. Service imports
import app.services.display_service  as display_service_module
import app.services.input_service    as input_service_module
import app.services.data_service     as data_service_module
import os

class GenesisApp(App):
    def build(self):
        # 4. Display service first — sets immersive mode and reads insets
        display_service_module.init()

        # 5. Input service — binds to Window (Window now exists)
        input_service_module.init()

        # 6. Data service — loads all JSON definitions
        data_dir = os.path.join(os.path.dirname(__file__), 'assets', 'data')
        data_service_module.init(data_dir)

        # 7. Screen manager wired here in Phase 2
```

---

## Build Order for `display_service`

1. **`display_service_1.py`** — Android immersive mode helpers
   (two code paths: API ≥ 30 and API < 30, plus no-op stub for non-Android)
2. **`display_service_2.py`** — Safe-area inset readers
   (modern, legacy, iOS, fallback)
3. **`display_service.py`** — `DisplayService` class composing both helpers;
   re-applies immersive on `Window.on_restore`
4. **`__init__.py`** — exposes `init()`, `get()`, `DisplayService`

---

## Testing Plan

| Test | Approach |
|---|---|
| Fallback insets on desktop | `display_service.get_safe_insets()` returns `{top:24, bottom:48, left:0, right:0}` with no Android runtime |
| Immersive no-op on desktop | `apply_immersive_mode()` does not raise when platform ≠ 'android' |
| Inset dict keys present | All four keys always present regardless of platform |
| Config fullscreen set before Window | Import order test — verify `Window.fullscreen` reflects config |

Tests for `display_service` live in `tests/test_display_service.py`.
Android-specific paths are tested by mocking pyjnius via `unittest.mock`.

---

## Scope Boundary

This plan covers **setup and insets only**. It does not cover:
- Screen manager / navigation (Phase 2)
- Asset density selection at runtime (Phase 3)
- Dynamic layout reflow for foldables or split-screen (future)
