// Explicit allow-list: production, database and live-provider audits are never
// selected by file-name discovery. Each suite mocks its external boundaries.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const checks = ['ai-fallback','audio-backup','auxiliary-ai-backup','chat-deletion','chef-chat','consumption-only','content-reports',
  'cooking-measurements','extraction-recovery','generation-provider-retry','generation-recovery',
  'guest-recipe-handoff','import-adaptation','ingredient-quantities','meal-plan-draft-changes','meal-plan-drafts','meal-plan-generation','meal-plan-safety',
  'meal-replacement','mobile-content-reports','mobile-foundation','mobile-signup','native-repair',
  'nutrition-comparison','nutrition-estimate','offline-session','onboarding-analytics','optional-microphone',
  'pantry-inventory','partner-code','recipe-browser','recipe-comparison','recipe-detail','recipe-edit-backup',
  'recipe-import','recipe-ingredient-integrity','shopping-cache','signup-adult-confirmation','tester-feedback',
  'visit-tracking','web-recipe-snapshot'];
let failed = 0;
for (const name of checks) {
  const cjs = `scripts/verify-${name}.cjs`;
  const args = fs.existsSync(cjs) ? [cjs] : ['--import','tsx',`scripts/verify-${name}.ts`];
  const result = spawnSync(process.execPath, args, { encoding:'utf8', timeout:90000, maxBuffer:3e6,
    env:{...process.env, GEMINI_API_KEY:'offline-synthetic-key', OPENAI_API_KEY:'offline-synthetic-key',
      AI_PROVIDER:'gemini', DATABASE_URL:'postgresql://invalid:invalid@localhost:1/disabled',
      NEXTAUTH_SECRET:'offline-synthetic-secret-not-an-account',
      ALLOW_SYNTHETIC_AI_TEST:'0', ALLOW_PRODUCTION_SYNTHETIC_TEST:'0', ALLOW_ROLLBACK_DATABASE_TEST:'0', QA26_LIVE:'0' } });
  const passed = result.status === 0;
  console.log(`${passed?'PASS':'FAIL'} ${name}`);
  if (!passed) { failed++; console.error(result.stdout,result.stderr,result.error?.message??''); }
}
console.log(`${checks.length-failed}/${checks.length} offline suites passed.`);
process.exitCode=failed?1:0;
