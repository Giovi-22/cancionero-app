import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { SetlistList } from '../components/SetlistList';
import { COLORS } from '../constants/theme';
import { Setlist } from '../types';
import { router } from 'expo-router';
import { AppHeader } from '../components/layout/AppHeader';

export const SetlistsScreen = () => {
  const {
    setlists,
    setActiveSetlist,
    setIsCreateSetlistOpen,
    handleDeleteSetlist,
    isSyncing,
    handleSync,
    user
  } = useAppContext();

  const handleSetlistPress = (setlist: Setlist) => {
    setActiveSetlist(setlist);
    router.push({ pathname: "/(tabs)/setlists/[id]", params: { id: setlist.id } } as any);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        title="Listas"
        isSyncing={isSyncing}
        onSync={handleSync}
        onSettings={() => router.push("/(tabs)/user")}
        hasUser={!!user}
      />
      <SetlistList
        setlists={setlists}
        onSetlistPress={handleSetlistPress}
        onCreatePress={() => setIsCreateSetlistOpen(true)}
        onDeleteSetlist={handleDeleteSetlist}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
