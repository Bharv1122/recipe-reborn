// Google identity is currently implemented only on Android. Do not link its
// unused iOS SDK (or require iOS OAuth configuration) into the email-based app.
module.exports = {
  dependencies: {
    'react-native-nitro-google-signin': { platforms: { ios: null } },
  },
};
