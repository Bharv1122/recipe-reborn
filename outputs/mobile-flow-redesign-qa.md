# Simpler mobile flow - implementation and QA

The home screen now presents three tasks: Scan a package, Use my ingredients, and Choose a dish. Recipes has a permanent tab; scanning is opened from the creation task. Optional food requests, collections, and delete actions are disclosed when needed.

## Connected paths

- Barcode -> product found -> Review ingredients -> Make my recipe. Missing ingredients offer a direct ingredient-photo action.
- Typed ingredients or a dish name -> one relevant input -> recipe result replacing the form.
- Reviewed pantry photos -> Use these ingredients -> recipe creation, without requiring an inventory save.
- Recipe result -> Save to My recipes -> saved recipe with plan and shopping actions.
- Shopping action -> editable ingredient draft -> explicit target list -> Add items. Ingredient commas remain intact in recipe drafts.
- Meal plan -> day and meal -> select a plan -> explicit Add recipe. A first-plan creation path is available when none exists. Optional weekly preferences are collapsed.

## Verification

- TypeScript, lint, Android export (1,407 modules), and iOS export (1,270 modules) passed for the redesign. A final response-shape correction to first-plan creation was checked separately.
- Browser preview renders the actual React Native screen components through React Native Web with simulated camera, navigation, auth and service responses. It is not a signed-device or production integration test.
- Walked barcode success -> ingredient review with no redundant mode choices -> result -> save -> recipe detail -> shopping draft -> explicit list add. A comma-containing ingredient remained one item.
- Walked ingredient and dish entry paths; empty inputs disable Make my recipe.
- Walked recipe -> day/meal -> plan selection; selection leaves an explicit Add button, which navigates to plan detail only after submission.
- Walked missing barcode -> direct ingredient-photo mode.
- Visually inspected and tightened the home layout at a 430-pixel content width.
- Reviewed endpoint response shapes for recipe save, first-plan creation, list creation and adding shopping items.

## Still requires phone verification

Install a new signed build, then test native tab navigation, back behavior, camera recognition/upload, keyboard interaction, real API responses, and account-specific pantry/meal/shopping flows. The installed build was not updated in this task. No cloud build, store upload, deployment, or production data mutation was performed.

Local preview: outputs/flow-preview/index.html, served by node outputs/flow-preview/server.cjs on 127.0.0.1:4179. Build with node outputs/flow-preview/build.mjs. The sample response is always oatmeal; do not interpret it as a live generation result. Preview navigation covers the main tested paths, not every app screen.
