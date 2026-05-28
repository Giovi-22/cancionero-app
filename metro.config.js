const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Permite a Metro Bundler resolver archivos .wasm requeridos por expo-sqlite en la web
config.resolver.assetExts.push('wasm');

module.exports = config;
