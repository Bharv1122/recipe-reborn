'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Menu,
  LogOut,
  User,
  BookOpen,
  UserCircle,
  Calendar,
  ShoppingCart,
} from 'lucide-react';

interface MobileNavProps {
  isAuthenticated: boolean;
}

export function MobileNav({ isAuthenticated }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        className="text-white hover:text-emerald-900 hover:bg-white/90 lg:hidden"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>
      <SheetContent
        side="right"
        className="bg-emerald-900 border-l border-white/20 text-white flex flex-col gap-2 w-3/4 sm:max-w-sm"
      >
        <SheetTitle className="text-white text-lg font-semibold">
          Menu
        </SheetTitle>

        {isAuthenticated ? (
          <>
            <Link href="/generator" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                Recipe Generator
              </Button>
            </Link>
            <Link href="/recipes" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                My Recipes
              </Button>
            </Link>
            <Link href="/collections" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Collections
              </Button>
            </Link>
            <Link href="/meal-planner" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Meal Planner
              </Button>
            </Link>
            <Link href="/shopping-lists" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Shopping
              </Button>
            </Link>
            <Link href="/account" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                <UserCircle className="h-4 w-4 mr-2" />
                Account
              </Button>
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                close();
                signOut({ callbackUrl: '/' });
              }}
              className="w-full justify-start text-white hover:text-red-200 hover:bg-red-900/30"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </>
        ) : (
          <>
            <Link href="/pricing" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                Pricing
              </Button>
            </Link>
            <Link href="/login" onClick={close}>
              <Button
                variant="ghost"
                className="w-full justify-start text-white hover:text-emerald-900 hover:bg-white/90"
              >
                <User className="h-4 w-4 mr-2" />
                Login
              </Button>
            </Link>
            <Link href="/signup" onClick={close}>
              <Button className="w-full justify-start bg-orange-500 hover:bg-orange-600 text-white font-semibold">
                Sign Up
              </Button>
            </Link>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
