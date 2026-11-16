from pathlib import Path
import json
import sqlite3

root = Path('/mnt/c/Users/bethh/Documents/recipe-reborn/outputs/comparison-qa')
session_ids = ['20260923_175609_797d21', '20260923_175840_de54cd', '20260923_180421_6abf20', '20260923_181034_7cc7fa']
connection = sqlite3.connect('file:/home/bethh/.hermes/state.db?mode=ro', uri=True)
connection.row_factory = sqlite3.Row
rows = connection.execute(
    'SELECT id, source, model, tool_call_count, api_call_count, input_tokens, output_tokens, billing_provider, billing_mode, cost_status '
    'FROM sessions WHERE id IN (?, ?, ?, ?) ORDER BY id', session_ids
).fetchall()
connection.close()
evidence = {
    'agentRuntime': 'Hermes Agent v0.15.1 (2026.5.29)',
    'source': 'Exact review session metadata from local Hermes state.db opened read-only; no transcript, authentication, or unrelated-session fields included.',
    'sessions': [dict(row) for row in rows],
}
(root / 'hermes-model-evidence.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf-8')
print(json.dumps(evidence, indent=2))
