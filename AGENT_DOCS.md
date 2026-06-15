# 🎸 App Cancionero Mobile - Project Overview & AI Guidelines

Welcome! This document provides a comprehensive overview of the **App Cancionero Mobile** project. It is specifically designed to give you (the AI agent) the necessary context, rules, and technical specifications to continue developing this application effectively.

## 🎯 App Description
**App Cancionero Mobile** is a mobile application built for musicians to manage their song libraries, setlists, and perform live. 
Key features include:
- Managing multiple musical libraries.
- Creating and playing Setlists (`setlist-player`).
- Viewing and interacting with songs (`song/[id]`).
- Connecting and configuring Bluetooth pedals for hands-free page turning (`pedal-config`).
- Syncing and persistent storage using SQLite and Supabase.

## 🛠️ Technology Stack
- **Framework**: React Native + Expo (v54+)
- **Navigation**: Expo Router (v6)
- **Language**: TypeScript (Strict typing preferred)
- **Database / Backend**: Expo SQLite (local storage) & Supabase (Cloud syncing & Auth)
- **Styling**: `StyleSheet` (React Native core) + `expo-linear-gradient` for UI elements.
- **Icons**: `lucide-react-native`
- **Animations/Gestures**: `react-native-reanimated` & `react-native-gesture-handler`

---

## 🛑 STRICT RULES FOR AI AGENTS

When generating code or refactoring this app, you **MUST** adhere to the following rules:

### 1. 🧹 Clean Code Practices
- **Modularity**: Break down large components into smaller, reusable pieces.
- **Single Responsibility Principle**: Each component, context, or hook should have exactly one job.
- **Naming Conventions**: Use descriptive variable and function names. Avoid cryptic abbreviations.
- **Comments & Documentation**: Document complex logic, but prefer self-explanatory code over excessive commenting.
- **No Dead Code**: Remove `console.log`s, unused imports, and commented-out legacy code before finalizing a file.

### 2. 🗺️ Navigation Standards (Expo Router)
- **Use Expo Router exclusively**: The app uses `expo-router` for file-based routing. Do NOT use standard `@react-navigation/native` components directly unless they are explicitly wrapped or required by Expo Router.
- **Use `Stack` and `Tabs`**: Rely on `expo-router`'s `<Stack>` and `<Tabs>` components. 
- Example of navigation methods to use:
  ```tsx
  import { router } from 'expo-router';
  
  // Good ✅
  router.push('/song/123');
  router.back();
  ```
- **Avoid prop drilling for navigation**: Use the `router` object or `<Link>` component from `expo-router`.
- Layouts (`_layout.tsx`) should define `Stack` screen options cleanly.

### 3. 🧩 Project Structure
- `app/`: Contains all screens and routing logic (managed by Expo Router).
  - `(tabs)/`: The main bottom tab navigation screens.
  - `song/[id].tsx`: Dynamic route for viewing a song.
  - `setlist-player/[setlistId].tsx`: Immersive mode for playing setlists.
  - `pedal-config.tsx`: Configuration screen for Bluetooth pedals.
- `src/`: Contains core logic, avoiding clutter in the `app` folder.
  - `src/components/`: Reusable UI elements and Modals (e.g., `LibrarySelectorModal`, `FolderPickerModal`).
  - `src/context/`: Global state management (e.g., `AppContext`).
  - `src/constants/`: Shared constants like `COLORS`, `THEME`, etc.

### 4. 🎨 UI / UX Guidelines
- Maintain the app's premium aesthetic. 
- Use the centralized `COLORS` constant located in `src/constants/theme`.
- Ensure Safe Areas are respected (using `SafeAreaProvider` and `react-native-safe-area-context`).
- Modals are managed globally within the layout (see `<GlobalModals>` in `app/_layout.tsx`).

### 5. 💾 Data Management
- Use `AppContext` for high-level UI state (e.g., modal visibility).
- Local storage operations should utilize `expo-sqlite` and `expo-file-system`.
- Assume cloud operations interface with Supabase.

---
**Agent Instruction:** Please confirm you have read these guidelines before proceeding with any new feature implementation or refactor. Keep your code clean, modular, and performant.
