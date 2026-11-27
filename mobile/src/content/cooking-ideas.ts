// Editorial prompts, not pre-generated recipes or nutrition advice.
// Rotation is local and repeats; generation still requires the user's action.
export const cookingIdeas = [
  { title: 'Make a familiar favorite', prompt: 'A homemade rice pilaf with vegetables' },
  { title: 'A pantry-friendly dinner', prompt: 'A simple chickpea and tomato stew' },
  { title: 'A weeknight remake', prompt: 'A homemade vegetable stir-fry with rice' },
  { title: 'Plan tomorrow too', prompt: 'A vegetable soup with clear serving quantities' },
] as const;
export const cookingTips = [
  'Read the whole recipe before starting. Check for soaking, resting or chilling time as well as cooking time.',
  'Chop and measure ingredients before turning on the heat, especially for a quick stir-fry.',
  'Check the pan size before doubling a recipe. A crowded pan may cook differently; use batches when needed.',
  'When changing servings, review every ingredient quantity and the cooking steps before you begin.',
] as const;
export function cookingIdeaForDate(date: Date) {
  const week = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000));
  return cookingIdeas[((week % cookingIdeas.length) + cookingIdeas.length) % cookingIdeas.length];
}
