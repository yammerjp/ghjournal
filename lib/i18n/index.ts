import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import ja from './locales/ja.json';
import en from './locales/en.json';

const resources = {
  ja: { translation: ja },
  en: { translation: en },
};

// Get device language (e.g., 'ja-JP' -> 'ja')
const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? 'en';

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
