from pathlib import Path
import hashlib
import json

repo = Path(__file__).resolve().parents[2]
out = repo / 'outputs/comparison-qa'
files = ['mobile/src/app/generate.tsx', 'mobile/src/components/recipe-comparison.tsx', 'shared/nutrition-facts.ts']
prompt = '''Perform a read-only final focused review of the exact source below. Use no tools. This is a supplement to a previous review that approved the pending-estimate save fix. Check only actual actionable defects, with file and trigger. The last two edits were removal of redundant setBusy/setFailed/setNutrition synchronous resets in the effect (initial state and retry event already set them), and normalization of scanned servingsPerContainer <= 0, missing, nonfinite or unreadable to null while preserving positive fractions. Both Save buttons and handler must be blocked pending, success saves the estimate, definite failure/45s timeout can intentionally save null, cleanup must reject late results, reopen must not request a new estimate. Actual-component isolated service tests passed pending/handler rejection, save/reopen, failed save, retry, timeout and late response, replacement recipe late response. Actual API handler tests with a repository double passed scan count conversion/save/reopen for missing/null/zero/negative/NaN/infinity/unreadable/2.5/string 3.5/8. Mobile tsc and lint pass. No physical-device verification of this patch is claimed. Report approve or actual defects, briefly. Do not suggest broad refactors or other tasks. Source is task-scoped project code only.\n'''
manifest = []
for file in files:
    data = (repo / file).read_bytes()
    source = data.decode('utf-8-sig')
    manifest.append({'file': file, 'sha256': hashlib.sha256(data).hexdigest()})
    prompt += '\nFILE ' + file + '\n' + '\n'.join(f'{i}: {line}' for i, line in enumerate(source.splitlines(), 1)) + '\n'
(out / 'hermes-final-supplement-request.txt').write_text(prompt, encoding='utf-8')
(out / 'hermes-final-supplement-manifest.json').write_text(json.dumps({'files': manifest}, indent=2), encoding='utf-8')
runner = (out / 'run-hermes-final-comparison-review.py').read_text(encoding='utf-8')
runner = runner.replace('hermes-final-comparison-request.txt', 'hermes-final-supplement-request.txt').replace('hermes-final-comparison-review', 'hermes-final-supplement-review')
(out / 'run-hermes-final-supplement-review.py').write_text(runner, encoding='utf-8')
print(json.dumps({'bytes': len(prompt.encode('utf-8')), 'files': files}))
