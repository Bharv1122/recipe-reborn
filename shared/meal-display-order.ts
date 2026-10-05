const order = ['breakfast', 'lunch', 'dinner', 'snack'];
export function mealDisplayRank(mealType: string): number {
  const index = order.indexOf(mealType.toLowerCase());
  return index < 0 ? order.length : index;
}
