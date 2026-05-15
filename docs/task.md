# Task List - Cancionero Mobile Migration

## Phase 1: Infrastructure [COMPLETED]
- [x] SQLite schema and StorageService
- [x] FileSystemService for offline songs
- [x] DriveService port (Native fetch)
- [x] chordUtils port

## Phase 2: Synchronization [IN PROGRESS]
- [x] SyncService logic (Incremental updates)
- [x] UI Integration (Sync button)

## Phase 3: Core UI [COMPLETED]
- [x] SongList component
- [x] SongViewer component (Ported from web)
  - [x] Transpose logic
  - [x] Auto-scroll engine
- [x] PedalHandler (Hardware pedal support)

## Phase 4: Auth & Polish [PENDING]
- [x] Google Login (Expo Auth Session + Supabase)
- [x] Setlist management (Sync with Supabase)
- [ ] Global settings (Scroll speed, font size defaults)
- [ ] Dark mode refinements
