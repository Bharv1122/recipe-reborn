'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut, User, BookOpen, UserCircle, Calendar, ShoppingCart } from 'lucide-react';
import { MobileNav } from '@/components/mobile-nav';
import { ColorThemeSelector } from '@/components/color-theme-selector';

export function Header() {
  const { status } = useSession();

  return (
    <header className="brand-header sticky top-0 z-50 w-full border-b border-white/30 backdrop-blur-sm transition-all-smooth">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <Image src="/logo-mark.png" alt="Recipe Reborn emblem" width={32} height={32} className="h-8 w-8 rounded-full shadow group-hover:scale-110 transition-all-smooth" />
            <span className="hidden rounded-full bg-white/95 px-3 py-1 font-serif text-xl font-bold italic leading-none shadow-sm sm:block" aria-label="Recipe Reborn">
              <span className="text-emerald-950">Recipe</span>
              <span className="text-orange-600">Reborn</span>
            </span>
          </Link>

          <div className="ml-auto mr-2 lg:ml-3">
            <ColorThemeSelector />
          </div>

          {/* Navigation (desktop) */}
          <nav className="hidden lg:flex items-center space-x-2">
            {status === 'loading' ? (
              <span className="px-3 text-sm text-emerald-50/80" role="status">
                Checking account…
              </span>
            ) : status === 'authenticated' ? (
              <>
                <Link href="/generator">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    Recipe Generator
                  </Button>
                </Link>
                <Link href="/recipes">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    My Recipes
                  </Button>
                </Link>
                <Link href="/collections">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Collections
                  </Button>
                </Link>
                <Link href="/meal-planner">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    <Calendar className="h-4 w-4 mr-2" />
                    Meal Planner
                  </Button>
                </Link>
                <Link href="/shopping-lists">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Shopping
                  </Button>
                </Link>
                <Link href="/account">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    <UserCircle className="h-4 w-4 mr-2" />
                    Account
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="text-white hover:text-red-200 hover:bg-red-900/30"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Link href="/pricing">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    Pricing
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="ghost" className="text-white hover:text-emerald-900 hover:bg-white/90">
                    <User className="h-4 w-4 mr-2" />
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>

          {/* Navigation (mobile) */}
          <div className="lg:hidden">
            <MobileNav authStatus={status} />
          </div>
        </div>
      </div>
    </header>
  );
}
