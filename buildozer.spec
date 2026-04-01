[app]
title = Genesis
package.name = genesis
package.domain = org.genesis

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json,ttf,ogg,mp3,wav

version = 0.1.0

requirements = python3,kivy,kivymd,pyjnius

# Orientation — portrait only, no landscape
orientation = portrait

# Full-screen immersive — Kivy-level suppression; display_service upgrades
# to Android immersive sticky via pyjnius at runtime
fullscreen = 1

# Keep screen on during gameplay (set to True only if actively needed)
android.wakelock = False

# Android
android.permissions = INTERNET
android.api = 33
android.minapi = 21
android.ndk = 25b
android.archs = arm64-v8a, armeabi-v7a

# Allow content to draw under system bars (required for true edge-to-edge)
android.add_activities = org.kivy.android.PythonActivity

# iOS
ios.kivy_ios_url = https://github.com/kivy/kivy-ios
ios.kivy_ios_branch = master

[buildozer]
log_level = 2
warn_on_root = 1
