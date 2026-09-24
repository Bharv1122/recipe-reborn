const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withOptionalMicrophone(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];
    const microphones = features.filter((feature) => feature.$['android:name'] === 'android.hardware.microphone');
    if (microphones.length === 0) {
      features.push({ $: { 'android:name': 'android.hardware.microphone', 'android:required': 'false' } });
    } else {
      for (const feature of microphones) feature.$['android:required'] = 'false';
    }
    // Voice is optional; keep RECORD_AUDIO so devices with a microphone can record.
    manifest['uses-feature'] = features;
    return mod;
  });
};
