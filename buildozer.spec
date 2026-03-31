[app]
title = Genesis
package.name = genesis
package.domain = org.genesis

source.dir = .
source.include_exts = py,png,jpg,kv,atlas,json,ttf,ogg,mp3,wav

version = 0.1.0

requirements = python3,kivy,kivymd,pyjnius

# Orientation
orientation = portrait

# Android
android.permissions = INTERNET
android.api = 33
android.minapi = 21
android.ndk = 25b
android.archs = arm64-v8a, armeabi-v7a

# iOS
ios.kivy_ios_url = https://github.com/kivy/kivy-ios
ios.kivy_ios_branch = master

[buildozer]
log_level = 2
warn_on_root = 1
