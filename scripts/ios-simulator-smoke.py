"""Launch already-built apps, without credentials, account writes or stored CI artifacts."""
import base64
import hashlib
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import tarfile
import tempfile
import time
import urllib.request

def run(*args, timeout=180):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT, timeout=timeout).strip()

# Select the newest installed Xcode; no SDK or paid service is installed.
xcodes = list(Path('/Applications').glob('Xcode*.app'))
def version_key(path):
    info = plistlib.loads((path / 'Contents/Info.plist').read_bytes())
    return tuple(int(n) for n in re.findall(r'\d+', info['CFBundleShortVersionString']))
selected = max(xcodes, key=version_key)
os.environ['DEVELOPER_DIR'] = str(selected / 'Contents/Developer')
print('SMOKE_XCODE', run('xcodebuild', '-version'), flush=True)
runtimes = json.loads(run('xcrun', 'simctl', 'list', 'runtimes', '-j'))['runtimes']
ios = [r for r in runtimes if r.get('isAvailable') and r['identifier'].startswith('com.apple.CoreSimulator.SimRuntime.iOS-')]
assert ios, 'No installed iOS Simulator runtime'
runtime = max(ios, key=lambda r: tuple(int(n) for n in r['version'].split('.')))
types = json.loads(run('xcrun', 'simctl', 'list', 'devicetypes', '-j'))['devicetypes']
device = next(d for d in types if d['name'] == 'iPhone 16')
udid = run('xcrun', 'simctl', 'create', 'RecipeReborn isolated smoke', device['identifier'], runtime['identifier'])
print('SMOKE_RUNTIME', json.dumps({'device': device['name'], 'runtime': runtime['version']}), flush=True)
run('xcrun', 'simctl', 'boot', udid)
run('xcrun', 'simctl', 'bootstatus', udid, '-b', timeout=300)

apps = [
    ('recipe-reborn', 'com.recipereborn.app', 'https://expo.dev/artifacts/eas/XZJ4snP1qYIzxPSq3Mv_PM5o_1KVb4BrIpgaxXXmkTE.tar.gz', 'e4d1943c7d5a57d6ab4ecca8da91e9f52c3e18d1910e618a4d6ca4970f52e0e2'),
    ('cheffo', 'com.cheffodoggo.app.preview', 'https://expo.dev/artifacts/eas/I5icrrgekf7voIpGwDliH_s4Y_Tf9Z6yWnSGPTmaXLA.tar.gz', '32ba724b6c1bb9a9caf1a6c9f2828b1d42c96524340d9fcf40d8ff6dd4d96d5f'),
]
results = []
def capture(name, root):
    image = root / (name + '.png')
    run('xcrun', 'simctl', 'io', udid, 'screenshot', str(image))
    encoded = base64.b64encode(image.read_bytes()).decode()
    # Public, signed-out simulator screens only. Use free run logs, no artifact/cache storage.
    for offset in range(0, len(encoded), 4000):
        print('SMOKE_IMAGE', name, encoded[offset:offset+4000], flush=True)

try:
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp)
        for name, bundle, url, digest in apps:
            try:
                archive = root / (name + '.tar.gz')
                with urllib.request.urlopen(url, timeout=120) as response:
                    archive.write_bytes(response.read())
                assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest, 'Artifact hash mismatch'
                folder = root / name
                folder.mkdir()
                with tarfile.open(archive) as tar:
                    tar.extractall(folder, filter='data')
                app = next(folder.glob('*.app'))
                info = plistlib.loads((app / 'Info.plist').read_bytes())
                assert info['CFBundleIdentifier'] == bundle
                run('xcrun', 'simctl', 'install', udid, str(app))
                launched = run('xcrun', 'simctl', 'launch', udid, bundle)
                pid = int(launched.rsplit(':', 1)[1].strip())
                time.sleep(20)
                process = run('ps', '-p', str(pid), '-o', 'comm=')
                assert info['CFBundleExecutable'] in process, process
                capture(name + '-launch', root)
                run('xcrun', 'simctl', 'terminate', udid, bundle)
                relaunched = run('xcrun', 'simctl', 'launch', udid, bundle)
                second_pid = int(relaunched.rsplit(':', 1)[1].strip())
                time.sleep(10)
                assert info['CFBundleExecutable'] in run('ps', '-p', str(second_pid), '-o', 'comm=')
                capture(name + '-reopen', root)
                if name == 'recipe-reborn':
                    run('xcrun', 'simctl', 'openurl', udid, 'recipereborn://walkthrough')
                    time.sleep(8)
                    capture(name + '-walkthrough', root)
                results.append({'app': name, 'bundleId': bundle, 'launch': True, 'aliveAfter20s': True, 'reopen': True, 'screenshotsCaptured': True, 'authenticatedTests': False})
                print('SMOKE_APP_PASS', name, flush=True)
                run('xcrun', 'simctl', 'terminate', udid, bundle)
            except Exception as error:
                results.append({'app': name, 'error': str(error)})
                print('SMOKE_APP_FAIL', name, repr(error), flush=True)
finally:
    print('SMOKE_RESULTS', json.dumps(results), flush=True)
    subprocess.run(['xcrun', 'simctl', 'shutdown', udid], capture_output=True)
assert len(results) == 2 and all(r.get('reopen') for r in results), 'One or more apps failed runtime smoke test'
