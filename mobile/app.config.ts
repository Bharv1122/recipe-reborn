import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Recipe Reborn',
  slug: 'recipereborn',
  owner: 'reciperebornmobile',
  platforms: ['ios', 'android'],
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'recipereborn',
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER || 'com.recipereborn.app',
    associatedDomains: ['applinks:recipereborn.com'],
    infoPlist: {
      NSCameraUsageDescription: 'Scan food labels and barcodes, or photograph your pantry for recipe suggestions.',
      NSPhotoLibraryUsageDescription: 'Choose food-label or pantry photos to analyze in Recipe Reborn.',
    },
  },
  android: {
    package: process.env.EXPO_ANDROID_PACKAGE || 'com.recipereborn.app',
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#FFF8EC',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    permissions: ['CAMERA', 'POST_NOTIFICATIONS'],
    intentFilters: [{
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: 'recipereborn.com', pathPrefix: '/reset-password' }],
      category: ['BROWSABLE', 'DEFAULT'],
    }],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      { image: './assets/images/recipe-reborn-logo.png', imageWidth: 120, resizeMode: 'contain', backgroundColor: '#FFF8EC' },
    ],
    ['expo-secure-store', { configureAndroidBackup: true }],
    'expo-sqlite',
    [
      'expo-camera',
      {
        cameraPermission: 'Scan food labels and barcodes, or photograph your pantry for recipe suggestions.',
        recordAudioAndroid: false,
        barcodeScannerEnabled: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose food-label or pantry photos to analyze in Recipe Reborn.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ['expo-notifications', { color: '#0B6B3A' }],
  ],
  experiments: { typedRoutes: true },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://recipereborn.com',
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '56cc462a-d0a6-4cc7-8ca8-907bcb76f2fd',
    },
  },
});
