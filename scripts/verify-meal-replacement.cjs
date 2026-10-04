const assert = require('node:assert/strict');
const esbuild = require('esbuild');
const Module = require('node:module');
const path = require('node:path');
let state;
const originalFetch = global.fetch;
async function main() {
  process.env.GEMINI_API_KEY = 'synthetic-gemini';
  process.env.OPENAI_API_KEY = 'synthetic-openai';
  process.env.AI_PROVIDER = 'auto';
  const mocks = {
    '@/lib/request-auth': `export const getRequestUserId=async()=>global.replaceQA.owner;`,
    '@/lib/entitlement': `export const ENTITLEMENT_SELECT={}; export const hasPremiumAccess=()=>true; export const premiumRequiredMessage=()=>'';`,
    '@/lib/ai-rate-limit': `export const limitAiRequest=async()=>null;`,
    '@/lib/db': `export const prisma={
      user:{findUnique:async()=>({allergies:['milk'],dislikedIngredients:['olives'],likedIngredients:[]})},
      mealPlanRecipe:{findFirst:async()=>({id:'entry',recipeId:'old',day:'monday',mealType:'dinner',servings:2}),findMany:async()=>[{recipe:{title:'Old meal'}}]},
      $queryRaw:async(strings,...args)=>{global.replaceQA.scope=args;return[{generationSettings:global.replaceQA.settings}]},
      $transaction:async fn=>fn({$queryRaw:async()=>[global.replaceQA.currentProfile],recipe:{create:async()=>{global.replaceQA.writes++}},mealPlanRecipe:{updateMany:async()=>({count:1}),findUnique:async()=>({id:'entry',recipe:{title:'New meal'}})}})
    };`,
  };
  const entry='app/api/meal-plans/[id]/recipes/[recipeId]/replace/route.ts';
  const built=await esbuild.build({entryPoints:[entry],bundle:true,platform:'node',format:'cjs',write:false,packages:'external',plugins:[{name:'mock',setup(build){
    build.onResolve({filter:/^@\/lib\//},args=>mocks[args.path]?{path:args.path,namespace:'mock'}:undefined);
    build.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
  }}]});
  const moduleUnderTest=new Module(path.resolve(entry),module); moduleUnderTest.filename=path.resolve(entry); moduleUnderTest.paths=module.paths; moduleUnderTest._compile(built.outputFiles[0].text,moduleUnderTest.filename);
  const route=moduleUnderTest.exports;
  const valid={title:'New meal',ingredients:['1 cup rice','2 carrots'],instructions:'Cook rice in water until tender. Steam carrots for 8 minutes and serve.',servings:2,prepTime:'5 min',cookTime:'20 min',dietaryTags:[],estimatedCalories:300};
  const invoke=()=>route.POST(new Request('https://app.invalid/api/replace',{method:'POST'}),{params:Promise.resolve({id:'plan',recipeId:'entry'})});
  const reset=()=>{state={owner:'owner',settings:{allergies:['peanuts'],dislikedIngredients:['spinach'],dietaryPreferences:['Vegan']},currentProfile:{allergies:['milk'],dislikedIngredients:['olives']},writes:0,calls:[]};global.replaceQA=state;};
  for(const test of ['valid','allergen','dislike','metric','outage','unknown','unauthorized','changed-preferences']) {
    reset();
    if(test==='unknown')state.settings=null;
    if(test==='unauthorized')state.owner=null;
    if(test==='changed-preferences')state.currentProfile.dislikedIngredients.push('carrots');
    global.fetch=async(url,init)=>{
      state.calls.push({url:String(url),body:JSON.parse(init.body)});
      if(String(url).includes('googleapis'))return new Response(null,{status:403});
      if(test==='outage')return new Response('PRIVATE',{status:503});
      const meal=structuredClone(valid);
      if(test==='allergen')meal.ingredients.push('1 tbsp peanut butter');
      if(test==='dislike')meal.ingredients.push('1 cup spinach');
      if(test==='metric')meal.ingredients=['200 g rice'];
      return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(meal)}}]});
    };
    const response=await invoke();
    const expected={valid:200,allergen:422,dislike:422,metric:422,outage:503,unknown:409,unauthorized:401,'changed-preferences':409}[test];
    assert.equal(response.status,expected,test);
    assert.equal(state.writes,test==='valid'?1:0,test+' writes');
    if(test==='valid'){
      assert.deepEqual(state.scope,['plan','owner']);
      const prompt=state.calls[1].body.messages[1].content;
      for(const term of ['peanuts','milk','spinach','olives','Vegan'])assert.ok(prompt.includes(term),term);
    }
    if(test==='outage')assert.equal(state.calls.length,2,'No duplicate backup on provider failure');
    if(test==='unknown'||test==='unauthorized')assert.equal(state.calls.length,0);
    console.log('PASS replacement',test);
  }
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{global.fetch=originalFetch;delete global.replaceQA;});
