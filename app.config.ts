import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "ghjournal",
  extra: {
    githubClientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? "",
    eas: {
      projectId: "ba26f045-b184-405a-95aa-1058f095f4e0",
    },
  },
  slug: "ghjournal",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "ghjournal",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "jp.yammer.ghjournal",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "jp.yammer.ghjournal",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    "react-native-legal",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-sqlite",
    "@react-native-community/datetimepicker",
    "expo-secure-store",
    "expo-localization",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.",
        locationAlwaysAndWhenInUsePermission:
          "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.",
        locationAlwaysPermission:
          "Your location is used to record your current location in diary entries and to fetch weather information for that location. Location data is saved as part of your diary entry.",
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    "./plugins/withInfoPlistLocalization.js",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
