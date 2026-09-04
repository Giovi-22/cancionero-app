import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SongMetadata, Library, Setlist } from '../types';
import { firestore } from '../lib/firebase';
import { authService } from '../services/AuthService';
import { StorageService } from '../services/StorageService';
import { SyncService } from '../services/SyncService';
import { DriveService } from '../services/DriveService';
import { FileSystemService } from '../services/FileSystemService';
import { Alert, Keyboard, Platform } from 'react-native';
import { router } from 'expo-router';

export interface AppContextType {
  user: any;
  setUser: (user: any) => void;
  activeLibrary: Library | null;
  libraries: Library[];
  setActiveLibrary: (library: Library) => Promise<void>;
  songs: SongMetadata[];
  topSongs: SongMetadata[];
  setlists: Setlist[];
  isSyncing: boolean;
  driveFolderId: string;
  setDriveFolderId: (id: string) => void;
  loadingSongId: string | null;
  loadingActions: Record<string, boolean>;

  // Modals state
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isLibrariesOpen: boolean;
  setIsLibrariesOpen: (open: boolean) => void;
  isFolderPickerOpen: boolean;
  setIsFolderPickerOpen: (open: boolean) => void;
  isCreateSetlistOpen: boolean;
  setIsCreateSetlistOpen: (open: boolean) => void;
  isEditSetlistOpen: boolean;
  setIsEditSetlistOpen: (open: boolean) => void;

  // Folder Explorer state
  folders: any[];
  isLoadingFolders: boolean;
  setFolderPickerCallback: (cb: ((id: string) => void) | null) => void;
  navigationStack: any[];
  showShared: boolean;
  openFolderPicker: (parentId?: string, folderName?: string, shared?: boolean, onSelect?: (id: string) => void) => Promise<void>;
  navigateBack: () => void;
  selectFolder: (id: string) => void;

  // Selected Viewer state
  selectedSong: SongMetadata | null;
  setSelectedSong: (song: SongMetadata | null) => void;
  songContent: string | null;
  setSongContent: (content: string | null) => void;
  songSettings: any;
  setSongSettings: (settings: any) => void;

  // Setlist view state
  activeSetlist: Setlist | null;
  setActiveSetlist: (setlist: Setlist | null) => void;
  setlistSongs: SongMetadata[];
  setSetlistSongs: (songs: SongMetadata[]) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Global Theme
  globalTheme: any;
  handleSaveGlobalTheme: (theme: any) => Promise<void>;

  // Band / Director session state
  /** ID de la banda activa para Director Mode (se setea al iniciar una sesión). */
  activeBandId: string | null;
  setActiveBandId: (id: string | null) => void;
  handleStartSetlistLocally: (setlist: Setlist) => void;
  handleFollowSongChange: (newSongId: string) => Promise<void>;

  // Actions
  refreshLocalData: () => Promise<void>;
  handleSync: () => Promise<void>;
  handleSongPress: (song: SongMetadata) => Promise<void>;
  handleSaveSongSettings: (data: any) => Promise<void>;
  handleSaveConfig: (folderId: string) => Promise<void>;
  handleDeleteSetlist: (setlist: Setlist) => Promise<void>;
  handleCreateSetlist: (name: string, date?: Date, notes?: string) => Promise<void>;
  handleRemoveSongFromSetlist: (songId: string) => Promise<void>;
  handleMoveSong: (fromIndex: number, toIndex: number) => Promise<void>;
  handleSaveSetlistSongs: (name: string, date: Date | undefined, songIds: string[], notes?: string) => Promise<void>;
  handleUpdateSetlistNotes: (setlistId: string, notes: string) => Promise<void>;
  handleUpdateSetlistSongNote: (setlistId: string, songId: string, note: string) => Promise<void>;
  handleClearRepertoire: () => Promise<void>;

  // Library Actions
  handleCreateLibrary: (name: string, driveFolderId?: string, icon?: string, color?: string) => Promise<void>;
  handleUpdateLibrary: (library: Library) => Promise<void>;
  handleDeleteLibrary: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLibrariesOpen, setIsLibrariesOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [driveFolderId, setDriveFolderId] = useState('');
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const startActionLoading = (actionName: string) => {
    setLoadingActions(prev => ({ ...prev, [actionName]: true }));
  };
  const stopActionLoading = (actionName: string) => {
    setLoadingActions(prev => ({ ...prev, [actionName]: false }));
  };

  // Bibliotecas
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [activeLibrary, setActiveLibraryState] = useState<Library | null>(null);

  // Datos
  const [songs, setSongs] = useState<SongMetadata[]>([]);
  const [topSongs, setTopSongs] = useState<SongMetadata[]>([]);
  const [setlists, setSetlists] = useState<Setlist[]>([]);

  // Estado del Visor
  const [selectedSong, setSelectedSong] = useState<SongMetadata | null>(null);
  const [songContent, setSongContent] = useState<string | null>(null);
  const [songSettings, setSongSettings] = useState<any>(null);

  // Band / Director Mode
  const [activeBandId, setActiveBandId] = useState<string | null>(null);
  const [setlistSongs, setSetlistSongs] = useState<SongMetadata[]>([]);

  // Estado de Setlist Activa
  const [activeSetlist, setActiveSetlist] = useState<Setlist | null>(null);

  // Tema global
  const [globalTheme, setGlobalTheme] = useState<any>({ background: '#0a0a0a', lyrics: '#ffffff', chords: '#3b82f6' });

  // Modals de creación / edición
  const [isCreateSetlistOpen, setIsCreateSetlistOpen] = useState(false);
  const [isEditSetlistOpen, setIsEditSetlistOpen] = useState(false);

  // Estado para el explorador de carpetas
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [folderPickerCallback, setFolderPickerCallback] = useState<((id: string) => void) | null>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [navigationStack, setNavigationStack] = useState<any[]>([{ id: 'root', name: 'Mi unidad' }]);
  const [showShared, setShowShared] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Inicialización
  useEffect(() => {
    loadInitialData();

    const unsubAuth = authService.onAuthStateChanged((u) => {
      setUser(u);
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Limpiar buscador al cambiar de lista
  useEffect(() => {
    setSearchQuery('');
  }, [activeSetlist]);

  const loadInitialData = async () => {
    let currentUser = null;
    try {
      currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (e) {
      console.warn('[AppContext] Failed to get user during loadInitialData (offline mode):', e);
    }

    try {
      // Cargar bibliotecas desde DB
      const allLibraries = await StorageService.getAllLibraries();
      setLibraries(allLibraries);

      // Obtener biblioteca activa
      const savedLibId = await StorageService.getSetting<string>('active_library_id');
      const activeLib = allLibraries.find(l => l.id === savedLibId) || allLibraries.find(l => l.id === 'default') || allLibraries[0] || null;

      setActiveLibraryState(activeLib);

      if (activeLib) {
        setDriveFolderId(activeLib.driveFolderId || '');
        await refreshLocalDataForLibrary(activeLib.id);

        if (activeLib.driveFolderId && currentUser) {
          triggerBackgroundSync(activeLib.driveFolderId, activeLib.id);
        }
      }

      // Cargar tema global
      const savedGlobalTheme = await StorageService.getSetting<any>('global_theme');
      if (savedGlobalTheme) {
        setGlobalTheme(savedGlobalTheme);
      }
    } catch (e) {
      console.error('Error loading initial local data:', e);
    }
  };

  const refreshLocalDataForLibrary = async (libId: string) => {
    const localSongs = await StorageService.getAllSongs(libId);
    setSongs(localSongs);
    const top = await StorageService.getTopSongs(5, libId);
    setTopSongs(top);
    const localSetlists = await StorageService.getAllSetlists(libId);
    setSetlists(localSetlists);
  };

  const refreshLocalData = async () => {
    if (activeLibrary) {
      await refreshLocalDataForLibrary(activeLibrary.id);
    }
  };

  const setActiveLibrary = async (library: Library) => {
    startActionLoading('setActiveLibrary');
    try {
      setActiveLibraryState(library);
      setDriveFolderId(library.driveFolderId || '');
      await StorageService.saveSetting('active_library_id', library.id);

      // Cerrar setlists y buscador para limpiar el contexto visual
      setActiveSetlist(null);

      await refreshLocalDataForLibrary(library.id);

      if (library.driveFolderId && user) {
        triggerBackgroundSync(library.driveFolderId, library.id);
      }
    } catch (e) {
      console.error('Error setting active library:', e);
    } finally {
      stopActionLoading('setActiveLibrary');
    }
  };

  const triggerBackgroundSync = async (folderId: string, libId: string) => {
    try {
      const didChange = await SyncService.syncFullRepertoire(folderId, false, libId);
      if (didChange) {
        await refreshLocalDataForLibrary(libId);
      }
    } catch (error) {
    }
  };

  const handleSync = async () => {
    if (isSyncing || !activeLibrary) return;
    setIsSyncing(true);
    try {
      await SyncService.syncFullRepertoire(driveFolderId, false, activeLibrary.id);
      await refreshLocalDataForLibrary(activeLibrary.id);
      Alert.alert('Éxito', 'Sincronización completada');
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'No se pudo sincronizar: ' + (error as any).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSongPress = async (song: SongMetadata) => {
    if (loadingSongId) return;
    setLoadingSongId(song.id);
    try {
      const content = await FileSystemService.getSongContent(song.id);
      if (!content) {
        Alert.alert('Error', 'No se encontró el contenido de la canción. Intenta sincronizar de nuevo.');
        return;
      }

      await StorageService.incrementSongViewCount(song.id);

      // Cargar configuraciones específicas de esta biblioteca
      const libId = activeLibrary?.id || 'default';
      let settings = await StorageService.getSetting(`song_settings_${libId}_${song.id}`);

      // Fallback a configuración anterior global si es la de por defecto
      if (!settings && libId === 'default') {
        settings = await StorageService.getSetting(`song_settings_${song.id}`);
      }

      setSongContent(content);
      setSongSettings(settings);
      setSelectedSong(song);

      await refreshLocalDataForLibrary(libId);
      // @ts-ignore
      router.push({ pathname: '/song/[id]', params: { id: song.id } });
    } catch (error) {
      Alert.alert('Error', 'No se pudo abrir la canción.');
    } finally {
      setLoadingSongId(null);
    }
  };

  // Navegar a una canción sin añadir al stack (para siguiente/anterior)
  const handleNavigateToSong = async (song: SongMetadata) => {
    try {
      const content = await FileSystemService.getSongContent(song.id);
      if (!content) {
        Alert.alert('Error', 'No se encontró el contenido de la canción.');
        return;
      }
      await StorageService.incrementSongViewCount(song.id);
      const libId = activeLibrary?.id || 'default';
      let settings = await StorageService.getSetting(`song_settings_${libId}_${song.id}`);
      if (!settings && libId === 'default') {
        settings = await StorageService.getSetting(`song_settings_${song.id}`);
      }
      setSongContent(content);
      setSongSettings(settings);
      setSelectedSong(song);
      // replace para NO acumular en el stack y evitar la doble animación
      router.replace(`/song/${song.id}`);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cambiar la canción.');
    }
  };

  const handleSaveSongSettings = async (data: any) => {
    if (data && data.songId && data.settings) {
      const libId = activeLibrary?.id || 'default';
      await StorageService.saveSetting(`song_settings_${libId}_${data.songId}`, data.settings);
    }
  };

  const handleSaveGlobalTheme = async (theme: any) => {
    setGlobalTheme(theme);
    await StorageService.saveSetting('global_theme', theme);
  };

  const handleSaveConfig = async (newFolderId: string) => {
    setDriveFolderId(newFolderId);
    if (activeLibrary) {
      const updated = {
        ...activeLibrary,
        driveFolderId: newFolderId,
        updatedAt: Date.now()
      };
      await StorageService.saveLibrary(updated);
      setActiveLibraryState(updated);
      setLibraries(prev => prev.map(l => l.id === updated.id ? updated : l));
    }
  };

  const handleDeleteSetlist = async (setlist: Setlist) => {
    startActionLoading(`deleteSetlist_${setlist.id}`);
    try {
      await StorageService.deleteSetlistLocal(setlist.id);
      await refreshLocalData();
    } finally {
      stopActionLoading(`deleteSetlist_${setlist.id}`);
    }
  };

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear().toString().slice(-2);
    return `${day}/${month}/${year}`;
  };

  const handleCreateSetlist = async (name: string, date?: Date, notes?: string) => {
    if (!activeLibrary) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const dateStr = date ? formatDate(date.toISOString()) : null;
    const finalName = dateStr ? `${trimmed} - ${dateStr}` : trimmed;

    const newSetlist: Setlist = {
      id: `local_${Date.now()}`,
      name: finalName,
      date: date ? date.toISOString() : undefined,
      songIds: [],
      isPublic: false,
      notes: notes?.trim() || undefined,
      libraryId: activeLibrary.id
    };
    await StorageService.saveSetlist(newSetlist, activeLibrary.id);
    await refreshLocalData();
    setIsCreateSetlistOpen(false);
    Keyboard.dismiss();
  };

  const handleRemoveSongFromSetlist = async (songId: string) => {
    if (!activeSetlist || !activeLibrary) return;
    const newSongIds = activeSetlist.songIds.filter(id => id !== songId);
    const updated = { ...activeSetlist, songIds: newSongIds };
    await StorageService.saveSetlist(updated, activeLibrary.id);
    setActiveSetlist(updated);
    await refreshLocalData();
  };

  const handleMoveSong = async (fromIndex: number, toIndex: number) => {
    if (!activeSetlist || !activeLibrary) return;
    const newSongIds = [...activeSetlist.songIds];
    const [movedId] = newSongIds.splice(fromIndex, 1);
    newSongIds.splice(toIndex, 0, movedId);

    const updated = { ...activeSetlist, songIds: newSongIds };
    await StorageService.saveSetlist(updated, activeLibrary.id);
    setActiveSetlist(updated);
    await refreshLocalData();
  };

  const handleSaveSetlistSongs = async (name: string, date: Date | undefined, songIds: string[], notes?: string) => {
    if (!activeSetlist || !activeLibrary) return;

    let cleanName = name.trim().split(' - ')[0];
    const dateStr = date ? formatDate(date.toISOString()) : null;
    const finalName = dateStr ? `${cleanName} - ${dateStr}` : cleanName;

    const updated = {
      ...activeSetlist,
      name: finalName,
      date: date ? date.toISOString() : undefined,
      songIds,
      notes: notes !== undefined ? notes : activeSetlist.notes
    };

    await StorageService.saveSetlist(updated, activeLibrary.id);
    setActiveSetlist(updated);
    setSetlists(prev => prev.map(s => s.id === updated.id ? updated : s));
    setIsEditSetlistOpen(false);
    await refreshLocalData();
  };

  const handleUpdateSetlistNotes = async (setlistId: string, notes: string) => {
    const targetSetlist = setlists.find(s => s.id === setlistId) || (activeSetlist?.id === setlistId ? activeSetlist : null);
    if (!targetSetlist || !activeLibrary) return;

    const updated: Setlist = {
      ...targetSetlist,
      notes
    };

    await StorageService.saveSetlist(updated, activeLibrary.id);
    if (activeSetlist?.id === setlistId) {
      setActiveSetlist(updated);
    }
    setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));
  };

  const handleUpdateSetlistSongNote = async (setlistId: string, songId: string, note: string) => {
    const targetSetlist = setlists.find(s => s.id === setlistId) || (activeSetlist?.id === setlistId ? activeSetlist : null);
    if (!targetSetlist || !activeLibrary) return;

    const currentNotes = { ...(targetSetlist.songNotes || {}) };
    const trimmed = note.trim();
    if (trimmed) {
      currentNotes[songId] = trimmed;
    } else {
      delete currentNotes[songId];
    }

    const updated: Setlist = {
      ...targetSetlist,
      songNotes: currentNotes
    };

    await StorageService.saveSetlist(updated, activeLibrary.id);
    if (activeSetlist?.id === setlistId) {
      setActiveSetlist(updated);
    }
    setSetlists(prev => prev.map(s => s.id === setlistId ? updated : s));
  };

  const handleClearRepertoire = async () => {
    if (!activeLibrary) return;
    try {
      setIsSyncing(true);
      // 1. Obtener todas las canciones locales de esta biblioteca
      const localSongs = await StorageService.getAllSongs(activeLibrary.id);

      // 2. Borrar archivos físicos
      for (const song of localSongs) {
        await FileSystemService.deleteSongFile(song.id);
      }

      // 3. Borrar registros de la base de datos local
      const db = await StorageService.getDb();
      await db.runAsync('DELETE FROM songs WHERE library_id = ?', [activeLibrary.id]);

      // 4. Borrar estadísticas en Firestore si está autenticado
      if (user) {
        try {
          const snapshot = await firestore().collection('song_stats').where('user_id', '==', user.id || user.uid).get();
          const batch = firestore().batch();
          snapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
          await batch.commit();
        } catch (error) {
          console.error('[Clear Repertoire] Error clearing Firestore stats:', error);
        }
      }

      // 5. Recargar datos locales
      await refreshLocalDataForLibrary(activeLibrary.id);

      Alert.alert('Éxito', 'Se limpiaron todas las canciones locales y sus estadísticas.');
    } catch (e) {
      console.error('[Clear Repertoire] Error clearing songs:', e);
      Alert.alert('Error', 'No se pudieron limpiar las canciones.');
    } finally {
      setIsSyncing(false);
    }
  };

  // --- CRUD de Bibliotecas en el Contexto ---
  const handleCreateLibrary = async (name: string, folderId?: string, icon?: string, color?: string) => {
    const now = Date.now();
    const newLib: Library = {
      id: `lib_${now}`,
      name: name.trim(),
      driveFolderId: folderId || '',
      syncEnabled: true,
      icon: icon || 'book-open',
      color: color || '#3b82f6',
      createdAt: now,
      updatedAt: now
    };

    await StorageService.saveLibrary(newLib);
    const all = await StorageService.getAllLibraries();
    setLibraries(all);

    // Cambiar automáticamente a la nueva biblioteca
    await setActiveLibrary(newLib);
  };

  const handleUpdateLibrary = async (library: Library) => {
    const updated = {
      ...library,
      updatedAt: Date.now()
    };
    await StorageService.saveLibrary(updated);
    const all = await StorageService.getAllLibraries();
    setLibraries(all);
    if (activeLibrary && activeLibrary.id === library.id) {
      setActiveLibraryState(updated);
    }
  };

  const handleDeleteLibrary = async (id: string) => {
    if (id === 'default') {
      Alert.alert('Error', 'No puedes eliminar la biblioteca principal.');
      return;
    }

    Alert.alert(
      'Eliminar Biblioteca',
      '¿Estás seguro? Esto eliminará localmente las canciones y listas de esta biblioteca.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await StorageService.deleteLibrary(id);
            const all = await StorageService.getAllLibraries();
            setLibraries(all);

            // Si eliminamos la activa, volvemos a la default
            if (activeLibrary && activeLibrary.id === id) {
              const def = all.find(l => l.id === 'default') || all[0];
              if (def) await setActiveLibrary(def);
            }
          }
        }
      ]
    );
  };

  // --- Director Mode helpers ---
  const handleStartSetlistLocally = (setlist: Setlist) => {
    const songsOfList = setlist.songIds
      .map(id => songs.find(s => s.id === id))
      .filter(Boolean) as SongMetadata[];
    setSetlistSongs(songsOfList);
    if (songsOfList.length > 0) {
      router.push({ pathname: '/setlist-player/[setlistId]', params: { setlistId: setlist.id } } as any);
    } else {
      Alert.alert('Lista vacía', 'Agrega canciones a la lista para poder iniciarla.');
    }
  };

  /**
   * Callback para que el SongViewer notifique al contexto cuando el Follower recibe
   * un evento SONG_CHANGED. Carga el contenido localmente sin navegar (el reproductor
   * es quien controla la navegación entre canciones).
   */
  const handleFollowSongChange = async (newSongId: string) => {
    const song = songs.find(s => s.id === newSongId);
    if (!song) return;
    const content = await FileSystemService.getSongContent(newSongId);
    if (!content) return;

    const libId = activeLibrary?.id || 'default';
    let settings = await StorageService.getSetting(`song_settings_${libId}_${newSongId}`);
    if (!settings && libId === 'default') {
      settings = await StorageService.getSetting(`song_settings_${newSongId}`);
    }

    setSongContent(content);
    setSongSettings(settings);
    setSelectedSong(song);
  };

  // Lógica del Explorador de Carpetas Drive
  const openFolderPicker = async (parentId: string = 'root', folderName: string = 'Mi unidad', shared: boolean = false, onSelect?: (id: string) => void) => {
    if (onSelect) {
      setFolderPickerCallback(() => onSelect);
    }
    setIsLoadingFolders(true);
    setIsFolderPickerOpen(true);
    setShowShared(shared);
    try {
      const folderList = await DriveService.listFolders(parentId, shared);
      setFolders(folderList);
      if (parentId === 'root') {
        setNavigationStack([{ id: 'root', name: shared ? 'Compartidos' : 'Mi unidad' }]);
      } else {
        setNavigationStack([...navigationStack, { id: parentId, name: folderName }]);
      }
    } catch (error: any) {
      console.error('[AppContext] Error en openFolderPicker:', error);
      Alert.alert('Error al acceder a Drive', error?.message || 'No se pudieron cargar las carpetas de Drive. Por favor, verifica tu conexión o intenta volver a iniciar sesión.');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const navigateBack = () => {
    if (navigationStack.length <= 1) return;
    const newStack = [...navigationStack];
    newStack.pop();
    const prevFolder = newStack[newStack.length - 1];
    setNavigationStack(newStack);
    openFolderPicker(prevFolder.id, prevFolder.name, showShared);
  };

  const selectFolder = (id: string) => {
    if (folderPickerCallback) {
      folderPickerCallback(id);
    } else {
      handleSaveConfig(id);
    }
    setIsFolderPickerOpen(false);
    setFolderPickerCallback(null);
    Keyboard.dismiss();
  };

  return (
    <AppContext.Provider
      value={{
        user,
        setUser,
        activeLibrary,
        libraries,
        setActiveLibrary,
        songs,
        topSongs,
        setlists,
        isSyncing,
        driveFolderId,
        setDriveFolderId,
        isSettingsOpen,
        setIsSettingsOpen,
        isLibrariesOpen,
        setIsLibrariesOpen,
        isFolderPickerOpen,
        setIsFolderPickerOpen,
        isCreateSetlistOpen,
        setIsCreateSetlistOpen,
        isEditSetlistOpen,
        setIsEditSetlistOpen,
        loadingSongId,
        loadingActions,
        folders,
        isLoadingFolders,
        navigationStack,
        showShared,
        openFolderPicker,
        navigateBack,
        selectFolder,
        setFolderPickerCallback,
        selectedSong,
        setSelectedSong,
        songContent,
        setSongContent,
        songSettings,
        setSongSettings,
        activeSetlist,
        setActiveSetlist,
        setlistSongs,
        setSetlistSongs,
        searchQuery,
        setSearchQuery,
        globalTheme,
        handleSaveGlobalTheme,
        activeBandId,
        setActiveBandId,
        handleStartSetlistLocally,
        handleFollowSongChange,
        refreshLocalData,
        handleSync,
        handleSongPress,
        handleSaveSongSettings,
        handleSaveConfig,
        handleDeleteSetlist,
        handleCreateSetlist,
        handleRemoveSongFromSetlist,
        handleMoveSong,
        handleSaveSetlistSongs,
        handleUpdateSetlistNotes,
        handleUpdateSetlistSongNote,
        handleCreateLibrary,
        handleUpdateLibrary,
        handleDeleteLibrary,
        handleClearRepertoire
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};
