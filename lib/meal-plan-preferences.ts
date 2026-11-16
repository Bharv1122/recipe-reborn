function uniqueCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveMealPlanPreferences(
  profile: { allergies: string[]; dislikedIngredients: string[] },
  overrides: { allergies?: string[]; dislikedIngredients?: string[] },
) {
  return {
    // A plan may add allergies, but an empty or omitted override cannot weaken
    // account allergies. Request validation rejects null before this runs.
    allergies: uniqueCaseInsensitive([...profile.allergies, ...(overrides.allergies ?? [])]),
    // Dislikes are preferences, so omitted inherits while [] explicitly clears
    // them for this plan only.
    dislikedIngredients: overrides.dislikedIngredients === undefined
      ? profile.dislikedIngredients
      : overrides.dislikedIngredients,
  };
}
