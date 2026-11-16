const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '../..');
const cli = 'C:/Users/bethh/AppData/Local/npm-cache/_npx/6bc7bae5c2059953/node_modules/eas-cli/bin/run';
const id = 'd9a9464e-5460-4602-84b9-0e59f612b34b';
(async () => {
  const result = spawnSync(process.execPath, [cli, 'submit:view', id, '--json'], { cwd: path.join(repo, 'mobile'), encoding: 'utf8', timeout: 120000, windowsHide: true });
  if (result.status !== 0) throw Error('Read-only submission lookup failed');
  const record = JSON.parse(result.stdout);
  if (record.id !== id) throw Error('Unexpected submission identity');
  const logs = [];
  for (const link of record.logFiles || []) {
    const url = typeof link === 'string' ? link : link.url;
    if (!url || !url.startsWith('https://')) throw Error('Unexpected log URL format');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw Error('Log fetch HTTP ' + response.status);
    const text = await response.text();
    const lines = text.split(/\r?\n/).filter(line => /draft|review|release_status|releaseStatus|changes_not|changesNot|track|error|warn|completed/i.test(line));
    const selected = lines.map(line => line
      .replace(/https?:\/\/\S+/g, '[URL omitted]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email omitted]')
      .slice(0, 5000));
    logs.push({ bytes: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex').toUpperCase(), selectedLines: selected });
  }
  const evidence = { checkedAt: new Date().toISOString(), submissionId: id, status: record.status, logs, rootConsoleObservation: 'After upload root observed Changes in review containing Data safety / Complete Data safety questionnaire only, with no app-release row. No root Send for review UI click occurred. Code14 draft needs its separate alpha Console verification.', action: 'Read-only inspection. No mutation, cancellation, withdrawal or retry.', limitation: 'Only release/review/error-related log lines retained; signed log URLs omitted.' };
  fs.writeFileSync(path.join(__dirname, 'code-14-draft-submit-log-evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
