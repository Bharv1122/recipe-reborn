const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module'),fs=require('node:fs'),esbuild=require('esbuild');
const runtime=path.join(process.env.TEMP,'recipe-reborn-voice-harness-20260923/node_modules');
const React=require(path.join(runtime,'react')),Renderer=require(path.join(runtime,'react-test-renderer'));
global.IS_REACT_ACT_ENVIRONMENT=true;
const requests=[],saves=[],timers=new Map();let timerId=0;
const realSetTimeout=global.setTimeout,realClearTimeout=global.clearTimeout;
global.setTimeout=(fn,delay,...args)=>{if(delay===45000){const id={qaTimer:++timerId};timers.set(id,fn);return id}return realSetTimeout(fn,delay,...args)};
global.clearTimeout=id=>timers.has(id)?timers.delete(id):realClearTimeout(id);
global.reviewApi=(url,options)=>{assert.equal(url,'/api/nutrition/estimate');return new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))};
global.reviewSave=(original,recipe,snapshot)=>{saves.push(snapshot);global.reviewSavedRecord={...recipe,id:'saved-review',originalIngredients:original,comparisonSnapshot:snapshot,freshIngredients:JSON.stringify(recipe.freshIngredients),instructions:JSON.stringify(recipe.instructions)};return {recipe:global.reviewSavedRecord}};
const mocks={
 'react-native':"export const ScrollView='scroll';export const Text='text';export const View='view';export const StyleSheet={create:x=>x};export const Alert={alert(){}};",
 'expo-crypto':"export const randomUUID=()=> 'review-generation';",
 'expo-router':"import {useEffect} from 'react';export const Stack={Screen:'stack'};export const useLocalSearchParams=()=>({source:'label',id:'saved-review',justSaved:'1'});export const useRouter=()=>({replace:value=>{global.reviewRoute=value},push(){}});export const useFocusEffect=fn=>useEffect(fn,[fn]);",
 '@/components/ui':"export const Screen='screen';export const Button='button';export const Card='card';export const Field='field';export const InlineError='error';",
 '@/components/voice-input':"export const VoiceInput='voice';",
 '@/services/scan-recipe-handoff':"export const takeScanRecipeHandoff=()=>null;",
 '@/services/shopping-handoff':"export const stageShoppingDraft=()=>{};",
 '@/services/recipes':"export const cancelRecipeGeneration=async()=>{};export const generateRecipe=async(input)=>({recipe:{title:input,freshIngredients:['1 cup oats','2 cups milk'],instructions:['Simmer.'],servings:'2',prepTime:'1',cookTime:'5'}});export const saveGeneratedRecipe=async(...args)=>global.reviewSave(...args);export const getRecipe=async()=>({recipe:global.reviewSavedRecord});",
 '@/services/api':"export const apiRequest=(...args)=>global.reviewApi(...args);",
 '@/theme':"export const colors={};"
};
const nutrition=n=>({calories:n,protein:9,carbs:30,fat:7,fiber:4,sodium:100,perServing:true,accuracy:'estimated',basisLabel:'Per serving',sourceLabel:'Test estimate'});
const act=Renderer.act,checks=[];
let Generate,Detail;
const buttons=root=>root.root.findAllByType('button');
const named=(root,label)=>buttons(root).find(x=>x.props.label===label);
const saveButtons=root=>buttons(root).filter(x=>/^(Finishing nutrition estimate|Save to My recipes|Save without nutrition estimate)/.test(x.props.label));
async function generate(root,input='oats, milk'){
 await act(async()=>root.root.findAllByType('field').find(x=>x.props.accessibilityLabel==='Ingredients').props.onChangeText(input));
 await act(async()=>{await named(root,'Make my recipe').props.onPress()});
}
async function mount(){let root;await act(async()=>{root=Renderer.create(React.createElement(Generate))});await generate(root);return root}
async function unmount(root){await act(async()=>root.unmount())}
async function save(root){await act(async()=>{await saveButtons(root)[0].props.onPress()})}
function pending(root){const targets=saveButtons(root);assert.equal(targets.length,2);assert(targets.every(x=>x.props.disabled&&x.props.label==='Finishing nutrition estimate…'));}
(async()=>{
 try{
 const result=await esbuild.build({stdin:{contents:"export {default as Generate} from './mobile/src/app/generate';export {default as Detail} from './mobile/src/app/recipes/[id]';",resolveDir:process.cwd(),loader:'ts'},bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',plugins:[{name:'review-harness',setup(build){
  build.onResolve({filter:/^react(\/.*)?$/},args=>({path:require.resolve(args.path,{paths:[runtime]}),external:true}));
  build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:null);
  build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
  build.onResolve({filter:/^@\//},args=>({path:path.resolve('mobile/src',args.path.slice(2)+'.tsx')}));
 }}]});
 const compiled=new Module(path.resolve('outputs/comparison-qa/lifecycle-generated.cjs'),module);compiled.filename=path.resolve('outputs/comparison-qa/lifecycle-generated.cjs');compiled.paths=Module._nodeModulePaths(process.cwd());compiled._compile(result.outputFiles[0].text,compiled.filename);({Generate,Detail}=compiled.exports);
 let root=await mount();pending(root);const before=saves.length;await save(root);assert.equal(saves.length,before,'Handler must reject saving while pending');
 await act(async()=>requests.at(-1).resolve(nutrition(220)));assert(saveButtons(root).every(x=>!x.props.disabled&&x.props.label==='Save to My recipes'));await save(root);assert.equal(saves.at(-1).freshNutrition.calories,220);await unmount(root);
 const calls=requests.length;await act(async()=>{root=Renderer.create(React.createElement(Detail))});assert.equal(requests.length,calls,'Reopen must not estimate again');assert.match(JSON.stringify(root.toJSON()),/220 kcal/);await unmount(root);checks.push('pending save blocked at both buttons and handler; successful result saved and reopened without another request');
 root=await mount();await act(async()=>requests.at(-1).reject(Error('Fixture estimate failure')));assert(saveButtons(root).every(x=>!x.props.disabled&&x.props.label==='Save without nutrition estimate'));await save(root);assert.equal(saves.at(-1).freshNutrition,null);await unmount(root);checks.push('definite failure intentionally allows a null estimate');
 root=await mount();await act(async()=>requests.at(-1).reject(Error('Fixture first attempt failure')));await act(async()=>named(root,'Retry nutrition').props.onPress());pending(root);await act(async()=>requests.at(-1).resolve(nutrition(230)));await save(root);assert.equal(saves.at(-1).freshNutrition.calories,230);await unmount(root);checks.push('retry returns both buttons to pending and saves its new successful result');
 root=await mount();const late=requests.at(-1);const expire=[...timers.values()].at(-1);assert(expire);await act(async()=>expire());assert(late.options.signal.aborted);assert(saveButtons(root).every(x=>!x.props.disabled&&x.props.label==='Save without nutrition estimate'));await act(async()=>late.resolve(nutrition(999)));await save(root);assert.equal(saves.at(-1).freshNutrition,null,'Late response after timeout must not overwrite failed snapshot');await unmount(root);checks.push('45-second timeout permits intentional save without estimate; late response ignored');
 root=await mount();const old=requests.at(-1);await act(async()=>named(root,'Change ingredients').props.onPress());assert(old.options.signal.aborted);await generate(root,'new oats');const current=requests.at(-1);await act(async()=>old.resolve(nutrition(999)));pending(root);await act(async()=>current.resolve(nutrition(240)));await save(root);assert.equal(saves.at(-1).freshNutrition.calories,240);await unmount(root);checks.push('late result from prior generation cannot unlock or contaminate a new recipe');
 assert.equal(timers.size,0,'Every estimate timer must be cleaned up');
 const evidence={passed:true,checks,estimateCalls:requests.length,saves:saves.length,usesActualComponents:true,services:'isolated doubles; no network or database'};
 fs.writeFileSync('outputs/comparison-qa/estimate-save-lifecycle-results.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 }finally{global.setTimeout=realSetTimeout;global.clearTimeout=realClearTimeout}
})().catch(error=>{console.error(error);process.exitCode=1});
