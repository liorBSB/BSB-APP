import { ImageResponse } from 'next/og';
import colors from '@/app/colors';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${colors.primaryGreen} 0%, ${colors.green} 100%)`,
          borderRadius: 36,
          color: colors.white,
          fontSize: 78,
          fontWeight: 800,
          letterSpacing: -3,
        }}
      >
        HE
      </div>
    ),
    size
  );
}
