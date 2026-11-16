const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const cli = 'C:/Users/bethh/AppData/Local/npm-cache/_npx/6bc7bae5c2059953/node_modules/eas-cli/bin/run';
const buildId = 'bc75c794-1646-4a98-85b7-38c2073fd009';
const [mode, id] = process.argv.slice(2);
const args = mode === 'build'
  ? [cli, 'build:view', buildId, '--json']
  : [cli, 'submit:view', id, '--json'];
if (!['build', 'submission'].includes(mode) || (mode === 'submission' && !/^[0-9a-f-]{36}$/.test(id || ''))) throw Error('Invalid mode or submission ID');
const result = spawnSync(process.execPath, args, { cwd: path.join(repo, 'mobile'), encoding: 'utf8', timeout: 120000, windowsHide: true });
if (result.status !== 0) { console.error('Read-only EAS check failed:', result.status, result.error?.message || result.stderr); process.exit(1); }
const item = JSON.parse(result.stdout);
let evidence;
if (mode === 'build') {
  evidence = { checkedAt: new Date().toISOString(), id: item.id, status: item.status, projectId: item.project?.id, package: item.appIdentifier, versionCode: item.appBuildVersion, gitCommitHash: item.gitCommitHash, buildProfile: item.buildProfile, platform: item.platform };
  if (item.id !== buildId || item.status !== 'FINISHED' || item.appIdentifier !== 'com.recipereborn.app' || String(item.appBuildVersion) !== '14' || item.gitCommitHash !== '0e094ccc0af6dfa4992528480ce726d24b7f6308' || item.buildProfile !== 'play-internal' || item.platform !== 'ANDROID') throw Error('Remote candidate mismatch');
} else {
  const cfg = item.androidConfig || {};
  const b = item.submittedBuild || {};
  const launchText = fs.readFileSync(path.join(__dirname, 'code-14-draft-upload.stdout.log'), 'utf8');
  const reviewDisabledConfirmedByLaunch = /Changes not sent for a review:\s+true/.test(launchText) && launchText.includes('/submissions/' + id);
  evidence = { checkedAt: new Date().toISOString(), id: item.id, status: item.status, platform: item.platform, projectId: item.app?.id, androidConfig: { track: cfg.track, releaseStatus: cfg.releaseStatus, changesNotSentForReviewFromApi: cfg.changesNotSentForReview ?? null }, changesNotSentForReviewEvidence: { value: true, confirmedByExactLaunchSummary: reviewDisabledConfirmedByLaunch, cliQueryLimitation: 'Installed submit:view GraphQL fragment omits this boolean; launch summary and validated submitted profile explicitly show true.' }, createdAt: item.createdAt, completedAt: item.completedAt, error: item.error ? { code: item.error.errorCode, message: item.error.message } : null, build: { id: b.id, package: b.appIdentifier, versionCode: b.appBuildVersion, profile: b.buildProfile }, note: 'EAS submission status concerns upload processing; a draft does not establish Play review, rollout or tester availability. Signed log URLs and credential fields intentionally excluded.' };
  if (cfg.track !== 'alpha' || String(cfg.releaseStatus).toLowerCase() !== 'draft' || !reviewDisabledConfirmedByLaunch || cfg.changesNotSentForReview === false || b.id !== buildId) {
    fs.writeFileSync(path.join(__dirname, 'code-14-draft-submission-unexpected.json'), JSON.stringify(evidence, null, 2) + '\n');
    throw Error('Remote draft-only submission metadata mismatch; stop and investigate.');
  }
}
fs.writeFileSync(path.join(__dirname, mode === 'build' ? 'code-14-fresh-build-check.json' : 'code-14-draft-submission.json'), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
