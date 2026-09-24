const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const mobile = path.resolve(__dirname, '../mobile');
const plugin = require('../mobile/plugins/with-optional-microphone');
const { AndroidConfig } = require('../mobile/node_modules/expo/config-plugins');
const micName = 'android.hardware.microphone';
const recordPermission = { $: { 'android:name': 'android.permission.RECORD_AUDIO' } };

async function apply(manifest) {
  const config = plugin({ name: 'fixture', slug: 'fixture' });
  const result = await config.mods.android.manifest({
    ...config,
    modResults: { manifest },
    modRequest: { platform: 'android', projectRoot: mobile },
  });
  return result.modResults.manifest;
}

function assertOptional(manifest) {
  const microphones = (manifest['uses-feature'] || []).filter((feature) => feature.$['android:name'] === micName);
  assert.equal(microphones.length, 1, 'Exactly one microphone feature is declared');
  assert.equal(microphones[0].$['android:required'], 'false', 'Google Play must not require microphone hardware');
  assert.ok((manifest['uses-permission'] || []).some((permission) => permission.$['android:name'] === 'android.permission.RECORD_AUDIO'), 'Voice recording permission must remain');
}

(async () => {
  const initial = { 'uses-permission': [recordPermission, { $: { 'android:name': 'android.permission.CAMERA' } }] };
  const result = await apply(structuredClone(initial));
  assertOptional(result);
  assert.deepEqual(result['uses-permission'], initial['uses-permission']);
  assert.deepEqual(await apply(structuredClone(result)), result, 'Repeated prebuild must be idempotent');

  for (const required of ['true', undefined]) {
    const camera = { $: { 'android:name': 'android.hardware.camera', 'android:required': 'true' } };
    const attributes = { 'android:name': micName, ...(required ? { 'android:required': required } : {}), 'android:version': '1' };
    const existing = await apply({ 'uses-permission': [recordPermission], 'uses-feature': [camera, { $: attributes }] });
    assertOptional(existing);
    assert.deepEqual(existing['uses-feature'][0], camera, 'Unrelated feature declarations stay unchanged');
    assert.equal(existing['uses-feature'][1].$['android:version'], '1', 'Unrelated microphone attributes stay unchanged');
  }

  const manifestPath = process.argv[2];
  if (manifestPath) {
    const actual = await AndroidConfig.Manifest.readAndroidManifestAsync(path.resolve(manifestPath));
    assertOptional(actual.manifest);
    console.log('PASS: actual generated AndroidManifest retains RECORD_AUDIO and declares microphone required=false.');
  }
  const configSource = fs.readFileSync(path.join(mobile, 'app.config.ts'), 'utf8');
  assert.ok(configSource.includes("'./plugins/with-optional-microphone'"), 'Plugin is registered in the real app config');
  console.log('PASS: real Expo mod handles absent/existing required features, preserves permissions/other features and stays idempotent.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
