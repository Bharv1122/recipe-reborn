export function useAuth(){return {user:{id:'qa',name:'Preview',allergies:[],dislikedIngredients:[]}};}
export const fixture={id:'qa-recipe',title:'Homemade Cinnamon Oatmeal',freshIngredients:['1 cup rolled oats','2 cups milk, or water','1 teaspoon cinnamon'],instructions:['Bring the liquid to a simmer.','Stir in oats and cook for five minutes.'],prepTime:'2 minutes',cookTime:'5 minutes',servings:'2',dietaryTags:[]};
export async function generateRecipe(input,options){window.qaGeneration={input,source:options.source};await new Promise(r=>setTimeout(r,100));return {recipe:fixture};}
export async function saveGeneratedRecipe(){window.qaSaved=true;return {recipe:fixture};}
export async function listRecipes(){return {recipes:window.qaSaved?[fixture]:[]};}
export async function getRecipe(){return {recipe:{...fixture,freshIngredients:JSON.stringify(fixture.freshIngredients),instructions:JSON.stringify(fixture.instructions)}};}
export async function cancelRecipeGeneration(){}
let lists=[{id:'qa-list',name:'This week',items:[]}];
let nutritionAttempts=0;
export async function apiRequest(path,options={}){
 const body=typeof options.body==='string'?JSON.parse(options.body):{};
 const scenario=new URLSearchParams(window.location.search).get('scenario');
 if(path==='/api/transcribe-audio'){
  window.qaVoiceUploads=(window.qaVoiceUploads||0)+1;
  if(scenario==='voice-cancel-upload')await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,2500);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Canceled'));},{once:true});});
  if(scenario==='voice-error')throw new Error('Voice is temporarily unavailable. Please type instead.');
  return {text:scenario==='voice-empty'?'':'Eggs, spinach, and cheddar'};
 }
 if(path==='/api/mobile/chat'){window.qaChatSent=body;return {message:{role:'assistant',content:'Try a spinach and cheddar omelet. Cook the eggs until set.'}};}
 if(path==='/api/pantry-inventory'){window.qaInventory=body;return {};}
 if(path==='/api/mobile/meal-plans/plan/recipes'){window.qaPlanChoice=body;return {};}
 if(path==='/api/mobile/meal-plans/plan')return {mealPlan:{id:'plan',name:'This week',mealPlanRecipes:[]}};
 if(path.endsWith('/barcode/missing'))return {found:false,name:'',ingredients_text:''};
 if(path.includes('/barcode/'))return {found:true,name:'Cinnamon Oats (sample)',ingredients_text:'Rolled oats, high fructose corn syrup, artificial flavor, salt',originalNutrition:scenario==='no-nutrition'?null:{values:{calories:160,protein:4,carbs:33,fat:2,fiber:3,sodium:240},basisLabel:'Per 40 g packet',source:scenario==='review'?'label_scan':'barcode',sourceLabel:'Sample package record',accuracy:'exact',servingsPerContainer:null,reviewRequired:scenario==='review'}};
 if(path==='/api/nutrition/estimate'){
  if(scenario==='nutrition-error' && nutritionAttempts++===0)throw new Error('Preview estimate failure');
  return {calories:220,protein:9,carbs:30,fat:7,fiber:4,sodium:100,perServing:true,accuracy:'estimated',basisLabel:'Per recipe serving (recipe makes 2)',sourceLabel:'Preview estimate'};
 }
 if(path.endsWith('/items')){window.qaShopping=body;lists[0].items=body.ingredients.map((ingredient,i)=>({id:String(i),ingredient,checked:false}));return {};}
 if(path==='/api/mobile/meal-plans')return {mealPlans:[{id:'plan',name:'This week',weekStartDate:'2026-09-14',mealPlanRecipes:[]}]};
 return {};
}
export async function apiResponse(path,options){
 if(path==='/api/pantry-inventory/extract'){
  window.qaPhotoLocations=options.body.getAll('locations');
  const empty=new URLSearchParams(window.location.search).get('scenario')==='photo-empty';
  return {ok:!empty,status:empty?422:200,json:async()=>({requiresReview:true,items:empty?[]:[{name:'Eggs',quantity:null,location:'fridge',confidence:'high'},{name:'Spinach',quantity:null,location:'fridge',confidence:'medium'},{name:'Rice',quantity:null,location:'pantry',confidence:'low'}],reviewNotes:[]})};
 }
 return {ok:true,json:async()=>({type:'ingredient_list',title:'Photo ingredients',ingredients:['oats','cinnamon']})};
}
export async function loadChatHistory(){return [];}
export async function saveChatHistory(){}
export async function clearChatHistory(){}
export async function fetchAndCacheShoppingLists(){return lists;}
export async function readCachedShoppingLists(){return lists;}
export async function flushShoppingToggleQueue(){}
export async function queueShoppingToggle(){}
