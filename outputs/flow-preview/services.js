export function useAuth(){return {user:{id:'qa',name:'Preview',allergies:[],dislikedIngredients:[]}};}
export const fixture={id:'qa-recipe',title:'Homemade Cinnamon Oatmeal',freshIngredients:['1 cup rolled oats','2 cups milk, or water','1 teaspoon cinnamon'],instructions:['Bring the liquid to a simmer.','Stir in oats and cook for five minutes.'],prepTime:'2 minutes',cookTime:'5 minutes',servings:'2',dietaryTags:[]};
export async function generateRecipe(input,options){window.qaGeneration={input,source:options.source};await new Promise(r=>setTimeout(r,100));return {recipe:fixture};}
export async function saveGeneratedRecipe(){window.qaSaved=true;return {recipe:fixture};}
export async function listRecipes(){return {recipes:window.qaSaved?[fixture]:[]};}
export async function getRecipe(){return {recipe:{...fixture,freshIngredients:JSON.stringify(fixture.freshIngredients),instructions:JSON.stringify(fixture.instructions)}};}
export async function cancelRecipeGeneration(){}
let lists=[{id:'qa-list',name:'This week',items:[]}];
export async function apiRequest(path,options={}){
 const body=options.body?JSON.parse(options.body):{};
 if(path==='/api/mobile/meal-plans/plan/recipes'){window.qaPlanChoice=body;return {};}
 if(path==='/api/mobile/meal-plans/plan')return {mealPlan:{id:'plan',name:'This week',mealPlanRecipes:[]}};
 if(path.endsWith('/barcode/missing'))return {found:false,name:'',ingredients_text:''};
 if(path.includes('/barcode/'))return {found:true,name:'Cinnamon Oats',ingredients_text:'Rolled oats, cinnamon, salt'};
 if(path.endsWith('/items')){window.qaShopping=body;lists[0].items=body.ingredients.map((ingredient,i)=>({id:String(i),ingredient,checked:false}));return {};}
 if(path==='/api/mobile/meal-plans')return {mealPlans:[{id:'plan',name:'This week',weekStartDate:'2026-09-14',mealPlanRecipes:[]}]};
 return {};
}
export async function apiResponse(){return {ok:true,json:async()=>({type:'ingredient_list',title:'Photo ingredients',ingredients:['oats','cinnamon']})};}
export async function fetchAndCacheShoppingLists(){return lists;}
export async function readCachedShoppingLists(){return lists;}
export async function flushShoppingToggleQueue(){}
export async function queueShoppingToggle(){}
