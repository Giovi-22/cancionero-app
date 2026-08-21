const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = {
  expo: {
    name: IS_DEV ? 'Cancionero (Dev)' : 'Cancionero Mobile',
    slug: 'App-cancionero-mobile',
    scheme: 'cancionero-app',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/app-icon-v3.png',
    userInterfaceStyle: 'dark',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff'
    },
    ios: {
      supportsTablet: true,
      icon: './assets/app-icon-v3.png',
      bundleIdentifier: IS_DEV ? 'com.giovi.cancionero.dev' : 'com.giovi.cancionero'
    },
    androidNavigationBar: {
      visible: 'immersive',
      barStyle: 'light-content',
      backgroundColor: '#1a1a1a'
    },
    android: {
      package: IS_DEV ? 'com.giovi.cancionero.dev' : 'com.giovi.cancionero',
      versionCode: 2,
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        foregroundImage: './assets/app-icon-v3.png',
        backgroundColor: '#ffffff'
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: './assets/favicon.png'
    },
    updates: {
      url: 'https://u.expo.dev/cc81069d-e4ad-4149-bd64-4f95d94b9516',
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0
    },
    runtimeVersion: {
      policy: 'appVersion'
    },
    plugins: [
      'expo-sqlite',
      'expo-router',
      '@react-native-community/datetimepicker',
      'expo-updates',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      '@react-native-google-signin/google-signin'
    ],
    extra: {
      router: {},
      eas: {
        projectId: 'cc81069d-e4ad-4149-bd64-4f95d94b9516'
      }
    },
    owner: 'giovi22'
  }
};
