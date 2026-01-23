"use client";

import React from "react";
import HeroLogo from "./HeroLogo";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section
      className="min-h-screen flex items-center justify-center py-20 px-4"
      style={{
        background:
          "radial-gradient(ellipse at center top, #14AB42 0%, #12A844 20%, #077840 50%, #054E3A 100%)",
      }}
    >
      <div className="text-center space-y-8 max-w-4xl mx-auto">
        {/* Logo with food, utensils, chef hat, and text positioned underneath */}
        <div className="flex flex-col items-center">
          <HeroLogo className="w-80 h-auto md:w-96 lg:w-[450px] drop-shadow-2xl" />
        </div>

        {/* Tagline */}
        <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto font-light">
          Transform processed food ingredients into fresh, healthy recipes with
          the power of AI.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center justify-center gap-4 pt-6">
          <Link href="/signup">
            <button className="bg-white text-emerald-700 hover:bg-emerald-50 text-lg px-8 py-3 rounded-md shadow-xl hover:shadow-2xl transition-all font-semibold">
              Get Started Free
            </button>
          </Link>
          <Link href="/login">
            <button className="text-lg px-8 py-3 rounded-md border-2 border-white text-white hover:bg-white/10 font-semibold transition-colors">
              Sign In
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
