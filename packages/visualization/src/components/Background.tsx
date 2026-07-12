import React from 'react';

export interface BackgroundProps {
  pan: { x: number; y: number };
  zoom: number;
  gap?: number;
  size?: number;
  color?: string;
  backgroundColor?: string;
  children?: React.ReactNode;
}

export const Background: React.FC<BackgroundProps> = ({
  pan,
  zoom,
  gap = 24,
  size = 1.2,
  color = '#cbd5e1', // slate-300
  backgroundColor = '#f8fafc', // slate-50
  children,
}) => {
  const scaledGap = gap * zoom;
  // We need to calculate the offset precisely so the dots move 1:1 with the canvas pan
  const xOffset = pan.x % scaledGap;
  const yOffset = pan.y % scaledGap;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor,
        backgroundImage: `radial-gradient(circle at ${size}px ${size}px, ${color} ${size}px, transparent 0)`,
        backgroundSize: `${scaledGap}px ${scaledGap}px`,
        backgroundPosition: `${xOffset}px ${yOffset}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
};
