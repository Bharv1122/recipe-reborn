const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const cli = 'C:/Users/bethh/AppData/Local/npm-cache/_npx/6bc7bae5c2059953/node_modules/eas-cli/bin/run';
const repo = path.resolve(__dirname, '../..');
const args = [cli, 'submit:list', '-p', 'android', '--limit', '20', '--json', '--non-interactive'];
const result = spawnSync(process.execPath, args, { cwd: path.join(repo, 'mobile'), encoding: 'utf8', timeout: 120000, windowsHide: true });
if (result.status !== 0) {
  console.error('Read-only EAS submission listing failed.', result.status, result.error?.message || result.stderr);
  process.exit(1);
}
const entries = JSON.parse(result.stdout);
const evidence = {
  checkedAt: new Date().toISOString(),
  installedCliVersion: '23.2.0',
  command: 'eas submit:list -p android --limit 20 --json --non-interactive',
  note: 'Selected nonsecret release metadata only; signed log URLs and unrelated fields excluded. No submissions, credential changes, or uploads performed.',
  submissions: entries.map(item => ({
    id: item.id, status: item.status, platform: item.platform,
    projectId: item.app?.id, account: item.app?.ownerAccount?.name,
    androidConfig: item.androidConfig,
    createdAt: item.createdAt, completedAt: item.completedAt,
    error: item.error ? { code: item.error.errorCode, message: item.error.message } : null,
    build: item.submittedBuild ? {
      id: item.submittedBuild.id, status: item.submittedBuild.status,
      packageName: item.submittedBuild.appIdentifier,
      distribution: item.submittedBuild.distribution,
      profile: item.submittedBuild.buildProfile,
      version: item.submittedBuild.appVersion,
      versionCode: item.submittedBuild.appBuildVersion,
      createdAt: item.submittedBuild.createdAt,
      completedAt: item.submittedBuild.completedAt,
    } : null,
  })),
};
fs.writeFileSync(path.join(__dirname, 'submission-history.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
