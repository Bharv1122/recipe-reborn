"use client";

import React from "react";

interface HeroLogoProps {
  className?: string;
}

export default function HeroLogo({ className = "" }: HeroLogoProps) {
  return (
    <svg
      viewBox="0 0 400 350"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Fork - Left side */}
      <g transform="translate(60, 30) rotate(-25)">
        <rect x="5" y="0" width="3" height="50" fill="#B8860B" rx="1" />
        <rect x="12" y="0" width="3" height="50" fill="#B8860B" rx="1" />
        <rect x="19" y="0" width="3" height="50" fill="#B8860B" rx="1" />
        <rect x="0" y="45" width="27" height="15" fill="#B8860B" rx="3" />
        <rect x="8" y="55" width="11" height="60" fill="#B8860B" rx="2" />
      </g>

      {/* Spoon - Right side */}
      <g transform="translate(310, 30) rotate(25)">
        <ellipse cx="15" cy="25" rx="15" ry="25" fill="#B8860B" />
        <rect x="8" y="45" width="14" height="70" fill="#B8860B" rx="2" />
      </g>

      {/* Tomato - Left */}
      <g transform="translate(65, 50)">
        <circle cx="30" cy="30" r="28" fill="#E53E3E" />
        <ellipse cx="30" cy="8" rx="8" ry="5" fill="#48BB78" />
        <path d="M30 3 L30 -5 Q35 -8 32 -12" stroke="#48BB78" strokeWidth="2" fill="none" />
      </g>

      {/* Carrot - Left side */}
      <g transform="translate(30, 75) rotate(-15)">
        <path d="M0 60 Q15 40 10 0 Q25 40 40 60 Z" fill="#ED8936" />
        <ellipse cx="10" cy="0" rx="5" ry="10" fill="#48BB78" transform="rotate(-20)" />
        <ellipse cx="15" cy="-5" rx="4" ry="8" fill="#48BB78" transform="rotate(0)" />
        <ellipse cx="20" cy="0" rx="5" ry="10" fill="#48BB78" transform="rotate(20)" />
      </g>

      {/* Broccoli - top center-left */}
      <g transform="translate(130, 20)">
        <circle cx="15" cy="15" r="15" fill="#48BB78" />
        <circle cx="30" cy="10" r="12" fill="#48BB78" />
        <circle cx="40" cy="20" r="14" fill="#48BB78" />
        <circle cx="25" cy="25" r="10" fill="#48BB78" />
        <rect x="23" y="30" width="8" height="25" fill="#68D391" rx="2" />
      </g>

      {/* Chef Hat - Center (WHITE) */}
      <g transform="translate(155, 40)">
        {/* Hat puffs */}
        <circle cx="45" cy="25" r="28" fill="#FFFFFF" />
        <circle cx="20" cy="35" r="22" fill="#FFFFFF" />
        <circle cx="70" cy="35" r="22" fill="#FFFFFF" />
        <circle cx="35" cy="15" r="20" fill="#FFFFFF" />
        <circle cx="55" cy="15" r="20" fill="#FFFFFF" />
        {/* Hat base */}
        <rect x="10" y="50" width="70" height="45" fill="#FFFFFF" rx="3" />
        {/* Hat band */}
        <rect x="10" y="85" width="70" height="8" fill="#E2E8F0" rx="2" />
      </g>

      {/* Bell Pepper - Right */}
      <g transform="translate(280, 45)">
        <path d="M25 0 Q40 15 40 40 Q35 55 25 60 Q15 55 10 40 Q10 15 25 0" fill="#F6E05E" />
        <rect x="22" y="-8" width="6" height="12" fill="#48BB78" rx="2" />
      </g>

      {/* Onion - Right side */}
      <g transform="translate(310, 70)">
        <ellipse cx="25" cy="30" rx="22" ry="28" fill="#D69E2E" />
        <path d="M20 5 Q25 -5 30 5" stroke="#48BB78" strokeWidth="3" fill="none" />
      </g>

      {/* Lettuce/Leaves - Behind center */}
      <g transform="translate(170, 90)">
        <ellipse cx="30" cy="30" rx="35" ry="20" fill="#68D391" transform="rotate(-10)" />
        <ellipse cx="60" cy="35" rx="30" ry="18" fill="#48BB78" transform="rotate(10)" />
      </g>

      {/* Plate/Bowl base */}
      <ellipse cx="200" cy="180" rx="100" ry="25" fill="#E2E8F0" opacity="0.3" />

      {/* Recipe Reborn Text - Positioned UNDER the food/utensils */}
      <g transform="translate(200, 260)">
        {/* "Recipe" in script font style */}
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fontFamily="'Brush Script MT', 'Segoe Script', cursive"
          fontSize="52"
          fill="#FFFFFF"
          fontWeight="normal"
          fontStyle="italic"
        >
          Recipe
        </text>
        {/* "Reborn" in different color */}
        <text
          x="0"
          y="55"
          textAnchor="middle"
          fontFamily="'Brush Script MT', 'Segoe Script', cursive"
          fontSize="52"
          fontWeight="normal"
          fontStyle="italic"
        >
          <tspan fill="#F6E05E">Re</tspan>
          <tspan fill="#FFFFFF">born</tspan>
        </text>
      </g>
    </svg>
  );
}
