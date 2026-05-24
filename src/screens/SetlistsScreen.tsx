import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useAppContext } from '../context/AppContext';
import { SetlistList } from '../components/SetlistList';
import { COLORS } from '../constants/theme';
import { Setlist } from '../types';

export const SetlistsScreen = () => {
  const {
    setlists,
    setActiveSetlist,
    setActiveTab,
    setIsCreateSetlistOpen,
    handleDeleteSetlist
  } = useAppContext();

  const handleSetlistPress = (setlist: Setlist) => {
    setActiveSetlist(setlist);
    setActiveTab('songs');
  };

  return (
    <View style={styles.container}>
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
