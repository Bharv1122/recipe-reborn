export function labelRecipePrompt(ingredients: string, productName?: string) {
  return `You are a professional chef. Someone has read the ingredient list off a packaged food and wants to make that same food at home, without the additives.

Ingredient list copied from the package: ${ingredients}
${productName ? `Product name from barcode lookup (reference data): ${JSON.stringify(productName)}` : ''}

First work out what the product actually is from that list. Pasta, whey and cheese cultures means boxed macaroni cheese. Tomato paste, corn syrup and vinegar means ketchup. Enriched flour, cocoa and palm oil means a packaged chocolate cookie.

Then write a homemade recipe for THAT SAME DISH using whole, unprocessed ingredients.

Rules:
- The result must be recognisably the food they were about to eat out of the package. Never swap in a different dish.
- Every ingredient you list must genuinely belong in that dish. Do not introduce unrelated ingredients such as lentils, peppers or mushrooms unless the product itself contained them.
- Where the package used an additive, use the real ingredient it was imitating: real cheese instead of cheese powder, real vanilla instead of artificial flavour, paprika or annatto instead of Yellow 5.
- Title it so they recognise it as the homemade version of what they were holding.
- Read nested label groups as components (crust, cheese, sauce), then write practical home-cooking quantities for those components. Keep the full label in mind for allergies; do not discard sub-ingredients when checking safety. Do not copy percentages or industrial additive lists as cooking quantities.

Provide clear, step-by-step instructions.

Provide a JSON response with this exact structure:
{
  "title": "Recipe name",
  "freshIngredients": ["ingredient 1 with quantity", "ingredient 2 with quantity"],
  "instructions": ["Step 1 description", "Step 2 description"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": "4",
  "estimatedCostPerServing": 2.50,
  "storeBoughtCost": 6.75
}

Respond with raw JSON only. Do not include code blocks, markdown, or any other formatting.`;
}
