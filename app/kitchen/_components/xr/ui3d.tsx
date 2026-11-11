'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { Group, Shape, ShapeGeometry } from 'three';

/**
 * Minimal 3D UI kit for the WebXR kitchen, ported from the Hardware Anatomy
 * Lab (src/xr/ui3d.tsx). Every control responds the same way to a mouse click,
 * an XR ray + pinch, and a direct finger poke, because @react-three/xr turns
 * all three into ordinary pointer events.
 */

// Kitchen palette, matching app/kitchen/kitchen.css.
export const ui = {
  panel: '#13261c',
  raised: '#1a3325',
  line: '#2b4a38',
  hover: '#1f4a31',
  hoverLine: '#4ade80',
  accent: '#22c55e',
  accentInk: '#052e16',
  text: '#f4fbf6',
  muted: '#a9c2b3',
  amount: '#fcd34d',
  warn: '#f59e0b',
  warnBg: '#422006',
};

// Self-hosted Inter (OFL) so troika text never reaches out to a font CDN.
export const fonts = { regular: '/fonts/inter-latin-400-normal.woff', bold: '/fonts/inter-latin-600-normal.woff' };

export type V3 = [number, number, number];

const shapes = new Map<string, ShapeGeometry>();
export function roundedRect(w: number, h: number, r: number) {
  const key = `${w}:${h}:${r}`;
  let g = shapes.get(key);
  if (!g) {
    const s = new Shape();
    const x = -w / 2;
    const y = -h / 2;
    r = Math.min(r, w / 2, h / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    g = new ShapeGeometry(s, 4);
    shapes.set(key, g);
  }
  return g;
}

export function Panel({
  w,
  h,
  position,
  rotation,
  children,
  color = ui.panel,
  border = ui.line,
}: {
  w: number;
  h: number;
  position?: V3;
  rotation?: V3;
  children?: ReactNode;
  color?: string;
  border?: string;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={roundedRect(w + 0.006, h + 0.006, 0.022)} position={[0, 0, -0.0015]}>
        <meshBasicMaterial color={border} toneMapped={false} />
      </mesh>
      <mesh geometry={roundedRect(w, h, 0.02)}>
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.94} />
      </mesh>
      {children}
    </group>
  );
}

type TextProps = {
  children: ReactNode;
  position?: V3;
  size?: number;
  color?: string;
  bold?: boolean;
  maxWidth?: number;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  lineHeight?: number;
  letterSpacing?: number;
};
export function Label({
  children,
  position = [0, 0, 0],
  size = 0.016,
  color = ui.text,
  bold,
  maxWidth,
  anchorX = 'left',
  anchorY = 'top',
  lineHeight = 1.3,
  letterSpacing,
}: TextProps) {
  return (
    <Text
      position={[position[0], position[1], position[2] + 0.001]}
      fontSize={size}
      color={color}
      font={bold ? fonts.bold : fonts.regular}
      maxWidth={maxWidth}
      anchorX={anchorX}
      anchorY={anchorY}
      lineHeight={lineHeight}
      letterSpacing={letterSpacing}
      material-toneMapped={false}
    >
      {children}
    </Text>
  );
}

/** A button for ray-pinch, finger poke, or mouse. Sized for fingertips: keep h ≥ 0.04 m. */
export function Button3D({
  w,
  h,
  label,
  onPress,
  position,
  primary,
  active,
  disabled,
  warn,
  size = 0.017,
}: {
  w: number;
  h: number;
  label: string;
  onPress: () => void;
  position?: V3;
  primary?: boolean;
  active?: boolean;
  disabled?: boolean;
  warn?: boolean;
  size?: number;
}) {
  const [hover, setHover] = useState(0);
  const face = useRef<Group>(null);
  const pressed = useRef(0);
  useFrame((_, dt) => {
    if (face.current) {
      pressed.current = Math.max(0, pressed.current - dt * 4);
      face.current.position.z = -0.005 * Math.min(1, pressed.current * 2);
    }
  });
  const fill = disabled ? ui.raised : primary ? ui.accent : warn ? ui.warnBg : active || hover ? ui.hover : ui.raised;
  const border = primary ? ui.accent : warn ? ui.warn : active || hover ? ui.hoverLine : ui.line;
  const ink = primary && !disabled ? ui.accentInk : disabled ? '#5b7466' : ui.text;
  return (
    <group position={position}>
      <group ref={face}>
        <mesh geometry={roundedRect(w + 0.004, h + 0.004, 0.012)} position={[0, 0, 0.0005]}>
          <meshBasicMaterial color={border} toneMapped={false} />
        </mesh>
        <mesh
          geometry={roundedRect(w, h, 0.011)}
          position={[0, 0, 0.001]}
          onPointerEnter={() => setHover((v) => v + 1)}
          onPointerLeave={() => setHover((v) => Math.max(0, v - 1))}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            pressed.current = 1;
            onPress();
          }}
        >
          <meshBasicMaterial color={fill} toneMapped={false} />
        </mesh>
        <Label position={[0, 0, 0.002]} size={size} color={ink} bold anchorX="center" anchorY="middle">
          {label}
        </Label>
      </group>
    </group>
  );
}

/** A checklist row: poke or pinch anywhere on it to toggle. */
export function CheckRow3D({
  w,
  h,
  label,
  checked,
  highlight,
  onToggle,
  position,
}: {
  w: number;
  h: number;
  label: string;
  checked: boolean;
  highlight?: boolean;
  onToggle: () => void;
  position?: V3;
}) {
  const [hover, setHover] = useState(0);
  const box = h * 0.55;
  return (
    <group position={position}>
      <mesh
        geometry={roundedRect(w, h, 0.01)}
        onPointerEnter={() => setHover((v) => v + 1)}
        onPointerLeave={() => setHover((v) => Math.max(0, v - 1))}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <meshBasicMaterial color={hover ? ui.hover : highlight ? '#2a2a12' : ui.raised} toneMapped={false} />
      </mesh>
      <mesh geometry={roundedRect(box, box, 0.005)} position={[-w / 2 + 0.012 + box / 2, 0, 0.001]}>
        <meshBasicMaterial color={checked ? ui.accent : ui.muted} toneMapped={false} />
      </mesh>
      {!checked && (
        <mesh geometry={roundedRect(box - 0.005, box - 0.005, 0.004)} position={[-w / 2 + 0.012 + box / 2, 0, 0.0015]}>
          <meshBasicMaterial color={ui.raised} toneMapped={false} />
        </mesh>
      )}
      <Label
        position={[-w / 2 + 0.024 + box, 0, 0.002]}
        size={0.0145}
        anchorY="middle"
        maxWidth={w - box - 0.034}
        color={checked ? ui.muted : highlight ? ui.amount : ui.text}
        lineHeight={1.15}
      >
        {label}
      </Label>
    </group>
  );
}
