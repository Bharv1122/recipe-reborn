const assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module'),fs=require('node:fs'),esbuild=require('esbuild');
const runtime=path.join(process.env.TEMP,'recipe-reborn-voice-harness-20260923/node_modules');
const React=require(path.join(runtime,'react')),Renderer=require(path.join(runtime,'react-test-renderer'));
global.IS_REACT_ACT_ENVIRONMENT=true;
let resolveNutrition,signal;
global.reviewApi=(url,options)=>{assert.equal(url,'/api/nutrition/estimate');signal=options.signal;return new Promise(resolve=>{resolveNutrition=resolve})};
global.reviewSaved=null;global.reviewRoute=null;
const mocks={
 'react-native':"export const ScrollView='scroll';export const Text='text';export const View='view';export const StyleSheet={create:x=>x};",
 'expo-crypto':"export const randomUUID=()=> 'review-generation';",
 'expo-router':"import {useEffect} from 'react';export const Stack={Screen:'stack'};export const useLocalSearchParams=()=>({source:'label'});export const useRouter=()=>({replace:value=>{global.reviewRoute=value}});export const useFocusEffect=fn=>useEffect(fn,[fn]);",
 '@/components/ui':"export const Screen='screen';export const Button='button';export const Card='card';export const Field='field';export const InlineError='error';",
 '@/components/voice-input':"export const VoiceInput='voice';",
 '@/services/scan-recipe-handoff':"export const takeScanRecipeHandoff=()=>null;",
 '@/services/recipes':"export const cancelRecipeGeneration=async()=>{};export const generateRecipe=async()=>({recipe:{title:'Oats',freshIngredients:['1 cup oats','2 cups milk'],instructions:['Simmer.'],servings:'2',prepTime:'1',cookTime:'5'}});export const saveGeneratedRecipe=async(original,recipe,snapshot)=>{global.reviewSaved=snapshot;return {recipe:{id:'saved-review'}}};",
 '@/services/api':"export const apiRequest=(...args)=>global.reviewApi(...args);",
 '@/theme':"export const colors={};"
};
(async()=>{
 const result=await esbuild.build({entryPoints:['mobile/src/app/generate.tsx'],bundle:true,platform:'node',format:'cjs',write:false,jsx:'automatic',plugins:[{name:'review-harness',setup(build){
  build.onResolve({filter:/^react(\/.*)?$/},args=>({path:require.resolve(args.path,{paths:[runtime]}),external:true}));
  build.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:null);
  build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
  build.onResolve({filter:/^@\//},args=>({path:path.resolve('mobile/src',args.path.slice(2)+'.tsx')}));
 }}]});
 const compiled=new Module(path.resolve('outputs/comparison-qa/review-generated.cjs'),module);compiled.filename=path.resolve('outputs/comparison-qa/review-generated.cjs');compiled.paths=Module._nodeModulePaths(process.cwd());compiled._compile(result.outputFiles[0].text,compiled.filename);
 let root;await Renderer.act(async()=>{root=Renderer.create(React.createElement(compiled.exports.default))});
 await Renderer.act(async()=>{root.root.findAllByType('field').find(x=>x.props.accessibilityLabel==='Ingredients').props.onChangeText('oats, milk')});
 await Renderer.act(async()=>{await root.root.findAllByType('button').find(x=>x.props.label==='Make my recipe').props.onPress()});
 assert(resolveNutrition,'Estimate request must be pending');
 const button=root.root.findAllByType('button').find(x=>x.props.label==='Save to My recipes');
 const saveEnabled=!button.props.disabled&&!button.props.loading;
 await Renderer.act(async()=>{await button.props.onPress()});
 assert.equal(global.reviewSaved.freshNutrition,null);
 await Renderer.act(async()=>root.unmount());
 assert.equal(signal.aborted,true);
 const evidence={reproduced:true,saveEnabledWhileEstimatePending:saveEnabled,savedFreshNutrition:global.reviewSaved.freshNutrition,navigationRequested:!!global.reviewRoute,pendingEstimateAbortedOnNavigation:signal.aborted,source:'actual GenerateScreen and RecipeComparison mounted with deferred API double'};
 fs.writeFileSync('outputs/comparison-qa/save-before-estimate-reproduction.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
})().catch(error=>{console.error(error);process.exitCode=1});
