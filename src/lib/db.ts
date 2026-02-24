import bcrypt from 'bcryptjs';
import { Redis } from '@upstash/redis';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

// Initialize Redis client only if environment variables are set
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  
  if (url && token) {
    redis = new Redis({ url, token });
    return redis;
  }
  
  return null;
}

// In-memory fallback for development/testing when Redis is not configured
const inMemoryUsers: Map<string, User> = new Map();

async function getUsers(): Promise<User[]> {
  const client = getRedis();
  
  if (client) {
    try {
      const users = await client.get<User[]>('users');
      return users || [];
    } catch (error) {
      console.error('Redis get error:', error);
      return [];
    }
  }
  
  // Fallback to in-memory
  return Array.from(inMemoryUsers.values());
}

async function saveUsers(users: User[]): Promise<void> {
  const client = getRedis();
  
  if (client) {
    try {
      await client.set('users', users);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  // Also update in-memory for fallback
  inMemoryUsers.clear();
  users.forEach(u => inMemoryUsers.set(u.email.toLowerCase(), u));
}

export async function createUser(email: string, password: string, name: string): Promise<User | null> {
  const users = await getUsers();
  
  // Check if user already exists
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return null;
  }
  
  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser: User = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    password: hashedPassword,
    name,
    createdAt: new Date().toISOString(),
  };
  
  users.push(newUser);
  await saveUsers(users);
  
  return newUser;
}

export async function verifyUser(email: string, password: string): Promise<User | null> {
  const users = await getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return null;
  }
  
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return null;
  }
  
  return user;
}

export function getUserByEmail(email: string): User | null {
  // Note: This is synchronous and only works with in-memory data
  return inMemoryUsers.get(email.toLowerCase()) || null;
}

// ==================== RECIPE STORAGE ====================

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cookTime: string;
  servings: number;
  nutritionInfo: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  tags: string[];
  createdAt: string;
}

// In-memory fallback for recipes
const inMemoryRecipes: Map<string, Recipe> = new Map();

async function getRecipes(): Promise<Recipe[]> {
  const client = getRedis();
  
  if (client) {
    try {
      const recipes = await client.get<Recipe[]>('recipes');
      return recipes || [];
    } catch (error) {
      console.error('Redis get recipes error:', error);
      return [];
    }
  }
  
  return Array.from(inMemoryRecipes.values());
}

async function saveRecipes(recipes: Recipe[]): Promise<void> {
  const client = getRedis();
  
  if (client) {
    try {
      await client.set('recipes', recipes);
    } catch (error) {
      console.error('Redis set recipes error:', error);
    }
  }
  
  // Also update in-memory
  inMemoryRecipes.clear();
  recipes.forEach(r => inMemoryRecipes.set(r.id, r));
}

export async function createRecipe(userId: string, recipeData: Omit<Recipe, 'id' | 'userId' | 'createdAt'>): Promise<Recipe> {
  const recipes = await getRecipes();
  
  const newRecipe: Recipe = {
    ...recipeData,
    id: crypto.randomUUID(),
    userId,
    createdAt: new Date().toISOString(),
  };
  
  recipes.push(newRecipe);
  await saveRecipes(recipes);
  
  return newRecipe;
}

export async function getRecipesByUserId(userId: string): Promise<Recipe[]> {
  const recipes = await getRecipes();
  return recipes.filter(r => r.userId === userId).sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  const recipes = await getRecipes();
  return recipes.find(r => r.id === recipeId) || null;
}

export async function deleteRecipe(recipeId: string, userId: string): Promise<boolean> {
  const recipes = await getRecipes();
  const recipeIndex = recipes.findIndex(r => r.id === recipeId && r.userId === userId);
  
  if (recipeIndex === -1) {
    return false;
  }
  
  recipes.splice(recipeIndex, 1);
  await saveRecipes(recipes);
  
  return true;
}

export async function getUserRecipeStats(userId: string): Promise<{
  totalRecipes: number;
  recipesThisWeek: number;
  favoriteCuisine: string;
}> {
  const recipes = await getRecipesByUserId(userId);
  
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const recipesThisWeek = recipes.filter(r => 
    new Date(r.createdAt) >= oneWeekAgo
  ).length;
  
  // Find most common cuisine from tags
  const cuisineCounts: Record<string, number> = {};
  recipes.forEach(r => {
    r.tags.forEach(tag => {
      cuisineCounts[tag] = (cuisineCounts[tag] || 0) + 1;
    });
  });
  
  const favoriteCuisine = Object.entries(cuisineCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';
  
  return {
    totalRecipes: recipes.length,
    recipesThisWeek,
    favoriteCuisine,
  };
}
