'use client';
import { useId, useSyncExternalStore } from 'react';
import colors from '@/app/colors';

const noopSubscribe = () => () => {};

/** SSR + hydration must match server HTML; useSyncExternalStore avoids useState+useEffect timing bugs in Next/React concurrent hydration. */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

const strokeWidth = 2.5;

function HouseOutline() {
  return (
    <>
      <polygon
        points="32,6 6,30 58,30"
        stroke={colors.primaryGreen}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        fill="none"
      />
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
      <circle cx="36" cy="50" r="1.2" fill={colors.primaryGreen} />
    </>
  );
}

/** Same dimensions as the real loader; SSR + first client paint — avoids clipPath/useId hydration issues. */
function HouseLoaderShell({ size, text }) {
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
        <HouseOutline />
      </svg>
      {text ? (
        <p
          style={{
            color: colors.primaryGreen,
            fontWeight: 600,
            fontSize: '1rem',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

function HouseLoaderAnimated({ size, text }) {
  const rawId = useId();
  const clipDomId = `hc-${rawId.replace(/\W/g, '_')}`;
  const clipUrl = `url(#${clipDomId})`;

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
          <clipPath id={clipDomId}>
            <polygon points="32,6 6,30 58,30" />
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

        <g clipPath={clipUrl}>
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

        <HouseOutline />
      </svg>

      {text ? (
        <p
          style={{
            color: colors.primaryGreen,
            fontWeight: 600,
            fontSize: '1rem',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

export default function HouseLoader({ size = 80, text = '' }) {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <HouseLoaderShell size={size} text={text} />;
  }

  return <HouseLoaderAnimated size={size} text={text} />;
}
