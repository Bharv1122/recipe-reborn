"use client";

import React from "react";
import Image from "next/image";

export default function HeroSection() {
  return (
    <section
      className="min-h-screen flex items-center justify-center py-20 px-4 pt-32"
      style={{
        background:
          "radial-gradient(ellipse at center top, #14AB42 0%, #12A844 20%, #077840 50%, #054E3A 100%)",
      }}
    >
      <div className="text-center space-y-8 max-w-4xl mx-auto">
        {/* Large centered logo */}
        <div className="flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="Recipe Reborn Logo"
            width={500}
            height={500}
            className="w-72 h-auto md:w-96 lg:w-[480px] drop-shadow-2xl"
            priority
          />
        </div>

        {/* Tagline */}
        <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto font-light">
          Transform processed food ingredients into fresh, healthy recipes with
          the power of AI.
        </p>
      </div>
    </section>
  );
}
