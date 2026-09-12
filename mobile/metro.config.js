const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// This repo uses separate web/native installs, not package-manager workspaces.
// Include only the pure shared helpers; server code is not part of the app.
config.watchFolders = [...config.watchFolders, path.resolve(__dirname, '../shared')];

module.exports = config;
