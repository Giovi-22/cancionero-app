# Implementation Plan - Song Viewer & Navigation

This plan focuses on implementing the core song viewing experience and basic navigation within the mobile application.

## Current Status
- [x] Storage Layer (SQLite + FileSystem)
- [x] Core Services (DriveService, SyncService)
- [x] Song List UI
- [x] Song Viewer UI (Ported from web)
- [x] Pedal Support (PedalHandler)

## Next Steps
- [ ] Implement Google Auth in Expo (to get Access Token for Sync)
- [ ] Implement Setlists logic and UI
- [ ] Polish UI/UX and Styles

## Verification Plan
- Manual verification of transposing and scrolling in SongViewer.
- Test hardware pedal capture with the hidden TextInput approach.
