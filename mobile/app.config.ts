import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Recipe Reborn',
  slug: 'recipe-reborn',
  platforms: ['ios', 'android'],
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'recipereborn',
  userInterfaceStyle: 'light',
  icon: './assets/images/recipe-reborn-logo.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.EXPO_IOS_BUNDLE_IDENTIFIER || 'com.recipereborn.app',
    infoPlist: {
      NSCameraUsageDescription: 'Scan food labels and barcodes, or photograph your pantry for recipe suggestions.',
      NSPhotoLibraryUsageDescription: 'Choose food-label or pantry photos to analyze in Recipe Reborn.',
    },
  },
  android: {
    package: process.env.EXPO_ANDROID_PACKAGE || 'com.recipereborn.app',
    adaptiveIcon: {
      foregroundImage: './assets/images/recipe-reborn-logo.png',
      backgroundColor: '#FFF8EC',
    },
    permissions: ['CAMERA', 'POST_NOTIFICATIONS'],
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
    eas: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
      ? { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID }
      : undefined,
  },
});
