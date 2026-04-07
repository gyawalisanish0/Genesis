import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'org.genesis.genesis',
  appName: 'Genesis',
  webDir:  'dist',
  server: {
    // https scheme prevents mixed-content blocks on Android WebView
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#110f18',
    },
    SplashScreen: {
      // We render our own splash screen in React
      launchShowDuration: 0,
    },
  },
}

export default config
