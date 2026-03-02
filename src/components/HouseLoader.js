'use client';
import { useId } from 'react';
import colors from '@/app/colors';

export default function HouseLoader({ size = 80, text = '' }) {
  const uid = useId();
  const clipId = `house-clip-${uid}`;
  const strokeWidth = 2.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            {/* Roof triangle */}
            <polygon points="32,6 6,30 58,30" />
            {/* Body rectangle */}
            <rect x="12" y="30" width="40" height="28" />
          </clipPath>

          <style>{`
            @keyframes house-fill-rise {
              0%   { transform: translateY(100%); }
              100% { transform: translateY(0%); }
            }
            .house-fill-rect {
              animation: house-fill-rise 2s ease-in-out infinite alternate;
            }
          `}</style>
        </defs>

        {/* Animated fill clipped to house shape */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="house-fill-rect"
            x="0"
            y="0"
            width="64"
            height="64"
            rx="0"
            fill={colors.primaryGreen}
            opacity="0.18"
          />
        </g>

        {/* House outline — roof */}
        <polygon
          points="32,6 6,30 58,30"
          stroke={colors.primaryGreen}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          fill="none"
        />

        {/* House outline — body */}
        <rect
          x="12"
          y="30"
          width="40"
          height="28"
          stroke={colors.primaryGreen}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          fill="none"
        />

        {/* Door */}
        <rect
          x="26"
          y="42"
          width="12"
          height="16"
          rx="1"
          stroke={colors.primaryGreen}
          strokeWidth={strokeWidth * 0.7}
          fill="none"
        />

        {/* Door knob */}
        <circle cx="36" cy="50" r="1.2" fill={colors.primaryGreen} />
      </svg>

      {text && (
        <p style={{
          color: colors.primaryGreen,
          fontWeight: 600,
          fontSize: '1rem',
          margin: 0,
          textAlign: 'center',
        }}>
          {text}
        </p>
      )}
    </div>
  );
}
