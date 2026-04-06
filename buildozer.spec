[app]
title = Genesis
package.name = genesis
package.domain = org.genesis

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json,ttf,ogg,mp3,wav

# Keep APK lean and build times short — exclude dev/test artifacts
source.exclude_dirs = tests,.buildozer,.git,__pycache__,.github

version = 0.1.0

# kivymd removed: not yet used in production code (Material widgets pending)
requirements = python3,kivy==2.3.0,pyjnius

# Orientation — portrait only, no landscape
orientation = portrait

# Full-screen immersive — Kivy-level suppression; display_service upgrades
# to Android immersive sticky via pyjnius at runtime
fullscreen = 1

# Keep screen on during gameplay
android.wakelock = False

# Android SDK / NDK
android.permissions = INTERNET
android.api = 35
android.minapi = 21
android.ndk = 25b
android.archs = arm64-v8a, armeabi-v7a

# Required for unattended CI builds — accepts the Android SDK licence
# automatically so buildozer never blocks waiting for interactive input
android.accept_sdk_license = True

# iOS (not the active build target)
ios.kivy_ios_url = https://github.com/kivy/kivy-ios
ios.kivy_ios_branch = master

[buildozer]
log_level = 2
warn_on_root = 1
