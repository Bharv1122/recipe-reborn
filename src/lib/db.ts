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
