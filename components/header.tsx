'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ChefHat, LogOut, User, BookOpen, UserCircle, Calendar, ShoppingCart } from 'lucide-react';

export function Header() {
  const { data: session, status } = useSession() || {};

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm transition-all-smooth">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <ChefHat className="h-8 w-8 text-emerald-600 group-hover:text-orange-500 transition-all-smooth group-hover:scale-110" />
            <span className="font-bold text-xl bg-gradient-to-r from-emerald-600 to-orange-500 bg-clip-text text-transparent">
              RecipeReborn
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-2">
            {status === 'authenticated' ? (
              <>
                <Link href="/generator">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    Recipe Generator
                  </Button>
                </Link>
                <Link href="/recipes">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    My Recipes
                  </Button>
                </Link>
                <Link href="/collections">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Collections
                  </Button>
                </Link>
                <Link href="/meal-planner">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    Meal Planner
                  </Button>
                </Link>
                <Link href="/shopping-lists">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Shopping
                  </Button>
                </Link>
                <Link href="/account">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    <UserCircle className="h-4 w-4 mr-2" />
                    Account
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-gray-700 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/pricing">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    Pricing
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="text-gray-700 hover:text-emerald-600">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}