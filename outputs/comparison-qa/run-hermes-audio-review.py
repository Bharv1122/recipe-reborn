from pathlib import Path
import subprocess,json,time,os
root=Path('/mnt/c/Users/bethh/Documents/recipe-reborn/outputs/comparison-qa')
prompt=(root/'hermes-audio-review-request.txt').read_text(encoding='utf-8')
start=time.time()
cmd=['/home/bethh/.local/bin/hermes','chat','-Q','--max-turns','1','--ignore-rules','-t','todo','--source','tool','-q',prompt]
env=os.environ.copy()
env['HERMES_IGNORE_RULES']='1'
with (root/'hermes-audio-review.stdout.txt').open('w') as stdout,(root/'hermes-audio-review.stderr.txt').open('w') as stderr:
    result=subprocess.run(cmd,cwd=root,env=env,stdout=stdout,stderr=stderr,timeout=420)
(root/'hermes-audio-review-run.json').write_text(json.dumps({'exitCode':result.returncode,'elapsedSeconds':round(time.time()-start,2),'provider':'openai-codex','configuredModel':'gpt-5.5','hermesVersion':'0.15.1','maxTurns':1,'toolset':'todo','ignoreRulesAndMemory':True,'stdoutFile':'hermes-audio-review.stdout.txt','stderrFile':'hermes-audio-review.stderr.txt'},indent=2))
print(json.dumps({'exitCode':result.returncode,'elapsedSeconds':round(time.time()-start,2)}))

