# Task List - Cancionero Mobile Migration

## Phase 1: Infrastructure [COMPLETED]
- [x] SQLite schema and StorageService
- [x] FileSystemService for offline songs
- [x] DriveService port (Native fetch)
- [x] chordUtils port

## Phase 2: Synchronization [IN PROGRESS]
- [x] SyncService logic (Incremental updates)
- [/] UI Integration (Sync button) -> *Requires Google Auth Token*

## Phase 3: Core UI [COMPLETED]
- [x] SongList component
- [x] SongViewer component (Ported from web)
  - [x] Transpose logic
  - [x] Auto-scroll engine
- [x] PedalHandler (Hardware pedal support)

## Phase 4: Auth & Polish [PENDING]
- [ ] Google Login (Expo Auth Session)
- [ ] Setlist management
- [ ] Global settings (Scroll speed, font size defaults)
- [ ] Dark mode refinements
