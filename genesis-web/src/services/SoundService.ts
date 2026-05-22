// SoundService — Phaser WebAudio sound engine, no canvas.
// Phaser.HEADLESS creates a game with no renderer; the WebAudio manager
// is fully functional. Audio files live in public/audio/{key}.webm|mp3.
//
// Usage:
//   SoundService.init()                     — call once in App.tsx on mount
//   SoundService.playSfx('hit')             — one-shot effect
//   SoundService.playMusic('battle_theme')  — looping background track
//   SoundService.stopMusic()
//   SoundService.setSfxVolume(0.8)
//   SoundService.setMusicVolume(0.5)

import Phaser from 'phaser'
import { Capacitor } from '@capacitor/core'

// ── Registered audio keys ─────────────────────────────────────────────────────
// Add entries here as audio files land in public/audio/.

const SFX_KEYS: string[] = [
  // 'hit', 'miss', 'crit', 'heal', 'level_up', 'chest_open',
]

const MUSIC_KEYS: string[] = [
  // 'dungeon_theme', 'battle_theme', 'victory', 'defeat',
]

// ── State ─────────────────────────────────────────────────────────────────────

let _game:         Phaser.Game | null       = null
let _scene:        Phaser.Scene | null      = null
let _music:        Phaser.Sound.BaseSound | null = null
let _sfxVolume     = 0.8
let _musicVolume   = 0.5
let _ready         = false

// ── Phaser scene — loads all audio then signals ready ─────────────────────────

class SoundScene extends Phaser.Scene {
  constructor() { super({ key: 'sound' }) }

  preload() {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') + '/'
    for (const key of [...SFX_KEYS, ...MUSIC_KEYS]) {
      this.load.audio(key, [
        `${base}audio/${key}.webm`,
        `${base}audio/${key}.mp3`,
      ])
    }
  }

  create() {
    _scene = this
    _ready = true
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export const SoundService = {
  // Call once in App.tsx on mount. Safe to call multiple times.
  init(): void {
    if (_game) return
    _game = new Phaser.Game({
      type:  Phaser.HEADLESS,
      audio: { disableWebAudio: !Capacitor.isNativePlatform() && !window.AudioContext },
      scene: SoundScene,
      callbacks: {
        // Suppress Phaser's "Game is now running" console banner
        postBoot: () => {},
      },
    })
  },

  playSfx(key: string, volume = _sfxVolume): void {
    if (!_ready || !_scene || !SFX_KEYS.includes(key)) return
    _scene.sound.play(key, { volume })
  },

  playMusic(key: string): void {
    if (!_ready || !_scene || !MUSIC_KEYS.includes(key)) return
    if (_music?.key === key && _music.isPlaying) return
    _music?.stop()
    _music = _scene.sound.add(key, { loop: true, volume: _musicVolume })
    _music.play()
  },

  stopMusic(): void {
    _music?.stop()
    _music = null
  },

  setSfxVolume(v: number): void {
    _sfxVolume = Math.max(0, Math.min(1, v))
  },

  setMusicVolume(v: number): void {
    _musicVolume = Math.max(0, Math.min(1, v))
    if (_music) (_music as Phaser.Sound.WebAudioSound).setVolume(_musicVolume)
  },

  get isReady(): boolean { return _ready },
}
