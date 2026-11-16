const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/bethh/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path = require('node:path');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const scenario of ['', 'review', 'no-nutrition', 'nutrition-error']) {
   const page=await browser.newPage({viewport:{width:390,height:844}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:4179/?scenario='+scenario);
   await page.getByRole('button',{name:'Scan a package',exact:true}).click();
   await page.getByRole('button',{name:'Simulate barcode (preview only)',exact:true}).click();
   await page.getByRole('button',{name:'Review ingredients',exact:true}).click();
   await page.getByRole('button',{name:'Make my recipe',exact:true}).click();
   await page.getByText('Homemade Cinnamon Oatmeal',{exact:true}).waitFor();
   if(scenario==='nutrition-error') await page.getByText('Nutrition could not load. Your recipe is ready to use.').waitFor();
   else await page.getByText('220 kcal',{exact:true}).waitFor();
   const calls=await page.evaluate(()=>window.qaNutritionCalls);
   await page.getByRole('button',{name:scenario==='nutrition-error'?'Save without nutrition estimate':'Save to My recipes',exact:true}).first().click();
   await page.getByText('Saved in My recipes',{exact:true}).waitFor();
   await page.getByText('What changed?',{exact:true}).waitFor();
   if(!scenario) await page.getByText('160 kcal',{exact:true}).waitFor();
   if(scenario==='review') assert.match(await page.locator('body').innerText(),/Confirm the scanned values/);
   if(scenario==='no-nutrition') assert.match(await page.locator('body').innerText(),/No package Nutrition Facts/);
   if(scenario==='nutrition-error') assert.match(await page.locator('body').innerText(),/No homemade nutrition estimate was saved/);
   assert.equal(await page.evaluate(()=>window.qaNutritionCalls),calls,'Opening a saved recipe must not request another estimate.');
   await page.reload();
   await page.getByRole('button',{name:'Recipes',exact:true}).click();
   await page.getByText('Homemade Cinnamon Oatmeal',{exact:true}).click();
   await page.getByText('What changed?',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>window.qaNutritionCalls||0),0,'Reopening after reload must use saved facts.');
   if(!scenario) {
    await page.getByText('160 kcal',{exact:true}).waitFor();
    await page.getByText('220 kcal',{exact:true}).waitFor();
    await page.screenshot({path:path.join(__dirname,'saved-comparison-mobile.png'),fullPage:true});
    await page.getByText('What changed?',{exact:true}).scrollIntoViewIfNeeded();
    await page.getByText('220 kcal',{exact:true}).scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(__dirname,'saved-comparison-facts-mobile.png'),fullPage:true});
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
   assert.deepEqual(errors,[]);
   console.log('PASS browser save/reload/reopen:',scenario||'confirmed barcode');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
