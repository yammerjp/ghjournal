# ghjournal

A local-first journal app that syncs across devices using GitHub private repositories.

Built with React Native (Expo). **Currently iOS only.**

## Features

- **Local-first** - Works fully offline with SQLite storage
- **GitHub Sync** - Sync journal entries as Markdown files to your private repository
- **One entry per day** - Simple, focused journaling
- **Location & Weather** - Optionally record location and weather data with each entry
- **i18n** - Supports English and Japanese

## Installation

### From App Store

Coming soon.

### Development Build

#### Prerequisites

- Node.js 18+
- Xcode (for iOS development)
- [EAS CLI](https://docs.expo.dev/eas/) (optional, for building)

#### 1. Install dependencies

```bash
npm install
```

#### 2. Create a GitHub App

1. Go to [GitHub Developer Settings](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Configure:
   - **GitHub App name**: `ghjournal` (or your preferred name)
   - **Homepage URL**: `https://github.com/yourusername/ghjournal`
   - **Callback URL**: `ghjournal://oauth`
   - **Webhook**: Uncheck "Active"
   - **Permissions**:
     - Repository permissions > Contents: Read and write
   - **Where can this GitHub App be installed?**: Only on this account
4. Click "Create GitHub App"
5. Copy the Client ID

#### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
EXPO_PUBLIC_GITHUB_CLIENT_ID=your_client_id_here
```

#### 4. Run the app

This app uses native modules (`expo-secure-store`, `expo-sqlite`), so it requires a development build instead of Expo Go.

```bash
# iOS
npx expo run:ios
```

## Usage

### Getting Started

1. Launch the app
2. Start writing your journal entries (works offline)

### Setting Up GitHub Sync

1. Open Settings
2. Tap "Connect to GitHub"
3. Copy the displayed authentication code
4. Enter the code on GitHub
5. Select or create a private repository for syncing
6. Tap "Sync now" to start syncing

### Repository Structure

Synced entries are stored in the following structure:

```
ghjournal/
  entries/
    2025-01-15.md
    2025-01-16.md
    ...
```

Each file is a Markdown file with YAML frontmatter:

```markdown
---
title: Today's Title
date: 2025-01-15
location:
  latitude: 35.6762
  longitude: 139.6503
  city: Shibuya, Tokyo
weather:
  wmo_code: 1
  description: Clear sky
  temperature_min: 5.2
  temperature_max: 12.8
created_at: 2025-01-15T10:30:00+09:00
updated_at: 2025-01-15T14:20:00+09:00
---

Journal content goes here...
```

## Development

### Running Tests

```bash
npm test
```

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npm run lint
```

## Tech Stack

- [Expo](https://expo.dev/) / React Native
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) - Local database
- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) - Secure token storage
- [expo-location](https://docs.expo.dev/versions/latest/sdk/location/) - Location services
- [i18next](https://www.i18next.com/) - Internationalization
- [Open-Meteo API](https://open-meteo.com/) - Weather data
- GitHub API - Sync

## Platform Support

| Platform | Status |
|----------|--------|
| iOS      | Supported |
| Android  | Not yet (contributions welcome!) |
| Web      | Not planned |

## License

MIT
