import React from "react";
import { Stack } from "expo-router";
import { AppContextProvider } from "../context/AppContext";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { SongsScreen } from "../screens/SongsScreen";
import { SetlistsScreen } from "../screens/SetlistsScreen";

export default function DashboardLayout() {
    const BottomTab = createBottomTabNavigator();
    return (
        <AppContextProvider>
            <BottomTab.Navigator
                initialRouteName="home">
                <BottomTab.Screen name="home" component={HomeScreen} />
                <BottomTab.Screen name="songs" component={SongsScreen} />
                <BottomTab.Screen name="setlists" component={SetlistsScreen} />
            </BottomTab.Navigator>
        </AppContextProvider>
    );
}

