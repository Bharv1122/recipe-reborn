const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('dotenv').config({path:'.env.vercel-production',quiet:true});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();
const email = `comparison-rollback-${crypto.randomUUID()}@example.com`;
const marker = new Error('ROLLBACK_SYNTHETIC_COMPARISON_CHECK');
const snapshot = {version:1,source:'label',originalNutrition:{values:{calories:0,protein:3,carbs:null,fat:1,fiber:null,sodium:240},basisLabel:'Per 40 g packet',sourceLabel:'Synthetic label',servingsPerContainer:null,source:'typed',accuracy:'exact',reviewRequired:false},freshNutrition:{calories:220,protein:6,carbs:30,fat:8,fiber:null,sodium:0,perServing:true,accuracy:'estimated',basisLabel:'Per recipe serving',sourceLabel:'Synthetic estimate'}};
(async()=>{
  try {
    await prisma.$transaction(async tx=>{
      const user = await tx.user.create({data:{email,name:'Synthetic rollback test'}});
      const recipe = await tx.recipe.create({data:{userId:user.id,title:'Synthetic comparison test',originalIngredients:'oats',freshIngredients:'["oats"]',instructions:'["Cook"]',comparisonSnapshot:snapshot}});
      const reopened = await tx.recipe.findUniqueOrThrow({where:{id:recipe.id},select:{comparisonSnapshot:true}});
      assert.deepEqual(reopened.comparisonSnapshot,snapshot);
      throw marker;
    });
  } catch(error) { if(error !== marker && error.message !== marker.message)throw error; }
  assert.equal(await prisma.user.count({where:{email}}),0,'Rollback must leave no synthetic user.');
  console.log('PASS: real production PostgreSQL JSONB save/reopen preserves comparison, zero and null; transaction rolled back, no synthetic user retained. Not a deployed API or device test.');
})().catch(error=>{console.error(error.message.replace(/postgres(?:ql)?:\/\/\S+/g,'[database URL]'));process.exitCode=1;}).finally(()=>prisma.$disconnect());
