"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function Header() {
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
        </div>
      </div>
    </header>
  );
}
