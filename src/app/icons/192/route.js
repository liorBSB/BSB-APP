import { ImageResponse } from 'next/og';
import colors from '@/app/colors';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.gold,
          borderRadius: 42,
        }}
      >
        <svg
          width="58%"
          height="58%"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <polygon
            points="32,6 6,30 58,30"
            stroke={colors.primaryGreen}
            strokeWidth="4.5"
            strokeLinejoin="round"
            fill="none"
          />
          <rect
            x="12"
            y="30"
            width="40"
            height="28"
            stroke={colors.primaryGreen}
            strokeWidth="4.5"
            strokeLinejoin="round"
            fill="none"
          />
          <rect
            x="26"
            y="42"
            width="12"
            height="16"
            rx="1"
            stroke={colors.primaryGreen}
            strokeWidth="3"
            fill="none"
          />
          <circle cx="36" cy="50" r="1.6" fill={colors.primaryGreen} />
        </svg>
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  );
}
