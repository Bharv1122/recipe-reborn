import { originalNutritionFromLabelScan } from '../../shared/nutrition-facts';
import { recipeComparisonSchema } from '../../lib/recipe-comparison-validation';
const scan=originalNutritionFromLabelScan({calories:100,servingsPerContainer:0});
const result=recipeComparisonSchema.safeParse({version:1,source:'label',originalNutrition:scan,freshNutrition:null});
console.log(JSON.stringify({scannerProducedSnapshot:!!scan,servingsPerContainer:scan?.servingsPerContainer,saveSchemaAccepts:result.success,issues:result.success?[]:result.error.issues.map(issue=>({path:issue.path,message:issue.message}))}));
