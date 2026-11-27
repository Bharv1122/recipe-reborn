const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
(async () => {
  const state = []; let cursor = 0; const exits = [];
  globalThis.tourTest = { state: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], v => { state[i] = typeof v === 'function' ? v(state[i]) : v; }]; }, exit: p => exits.push(p) };
  const mocks = {
    react: 'export const useState=v=>globalThis.tourTest.state(v),useEffect=()=>{},useCallback=f=>f;',
    'react/jsx-runtime': 'export const jsx=(type,props)=>({type,props}),jsxs=jsx;',
    'react-native': 'export const ScrollView="ScrollView",Switch="Switch",Text="Text",View="View",StyleSheet={create:x=>x},AppState={addEventListener:()=>({remove(){}})};',
    'expo-router': 'export const useRouter=()=>({replace:p=>globalThis.tourTest.exit(p)}),useFocusEffect=()=>{};',
    'expo-speech': 'export const stop=async()=>{},speak=()=>{throw Error("Audio must remain off in default practice");};',
    '@/components/ui': 'export const Button="Button",Card="Card",Screen="Screen";',
  };
  const built = await esbuild.build({entryPoints:['mobile/src/app/walkthrough.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',alias:{'@':path.resolve('mobile/src')},plugins:[{name:'tour-test',setup(b){b.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:null);b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));}}]});
  const filename = path.resolve('scripts/tour-under-test.cjs');
  const mod = new Module(filename,module); mod.paths=module.paths;mod.filename=filename;mod._compile(built.outputFiles[0].text,filename);
  const render=()=>{cursor=0;return mod.exports.default();};
  const find=(n,p)=>Array.isArray(n)?n.map(x=>find(x,p)).find(Boolean):n&&typeof n==='object'?(p(n)?n:find(n.props?.children,p)):null;
  const button=(tree,label)=>find(tree,n=>n.props?.label===label);
  let tree=render(); assert.equal(find(tree,n=>n.type==='Switch').props.value,false);
  button(tree,'Try the example package').props.onPress();tree=render();
  assert.equal(button(tree,'Make a homemade version').props.disabled,true);
  button(tree,'I checked the example ingredients').props.onPress();tree=render();
  assert.equal(button(tree,'Make a homemade version').props.disabled,false);
  button(tree,'Make a homemade version').props.onPress();tree=render();button(tree,'Try lentils instead').props.onPress();tree=render();assert.ok(button(tree,'Lentils selected'));
  button(tree,'Explore estimated nutrition').props.onPress();tree=render();assert.equal(button(tree,'Finish practice').props.disabled,true);
  button(tree,'Check how to compare').props.onPress();tree=render();button(tree,'Finish practice').props.onPress();tree=render();button(tree,'Done').props.onPress();
  assert.deepEqual(exits,['/(tabs)']);button(render(),'Skip').props.onPress();assert.equal(exits.length,2);
  delete globalThis.tourTest;
  console.log('PASS: interactive practice checks ingredients, changes protein, gates nutrition checklist, completes with Done, supports Skip, and starts with audio off. Synthetic component test; not physical-device proof.');
})().catch(e=>{console.error(e);process.exitCode=1;});
