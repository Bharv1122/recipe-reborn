"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
}

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch("/api/auth/me");
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      setMenuOpen(false);
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
      style={{
        background:
          "linear-gradient(to bottom, rgba(20, 171, 66, 0.95) 0%, rgba(7, 120, 64, 0.9) 100%)",
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo on the left */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Recipe Reborn"
            width={60}
            height={60}
            className="w-12 h-12 md:w-14 md:h-14 rounded-lg"
            priority
          />
        </Link>

        {/* Auth buttons on the right */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="w-24 h-8 bg-white/20 rounded animate-pulse" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-white hover:text-white/80 font-medium text-base md:text-lg transition-colors"
              >
                <span className="hidden sm:block">{user.name}</span>
                <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-emerald-700 font-semibold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </button>
              
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login">
                <button className="text-white hover:text-white/80 font-medium text-base md:text-lg transition-colors">
                  Login
                </button>
              </Link>
              <Link href="/signup">
                <button className="bg-white text-emerald-700 hover:bg-emerald-50 font-semibold text-base md:text-lg px-5 py-2 rounded-md shadow-md hover:shadow-lg transition-all">
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
