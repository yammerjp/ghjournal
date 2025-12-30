import { ExpoConfig, ConfigContext } from "expo/config";

const GOOGLE_IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID = process.env.GOOGLE_WEB_CLIENT_ID;

// Derive iOS URL scheme from iOS Client ID
const getIosUrlScheme = (): string | undefined => {
  if (!GOOGLE_IOS_CLIENT_ID) return undefined;
  // Convert "xxx.apps.googleusercontent.com" to "com.googleusercontent.apps.xxx"
  const parts = GOOGLE_IOS_CLIENT_ID.split(".");
  if (parts.length >= 4 && parts.slice(-3).join(".") === "apps.googleusercontent.com") {
    return `com.googleusercontent.apps.${parts[0]}`;
  }
  return undefined;
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "diary.db",
  slug: "diary.db",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "diarydb",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "jp.yammer.diarydb",
  },
  android: {
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
    ...(getIosUrlScheme()
      ? [
          [
            "@react-native-google-signin/google-signin",
            {
              iosUrlScheme: getIosUrlScheme(),
            },
          ] as [string, { iosUrlScheme: string }],
        ]
      : []),
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    googleIosClientId: GOOGLE_IOS_CLIENT_ID,
    googleWebClientId: GOOGLE_WEB_CLIENT_ID,
  },
});
