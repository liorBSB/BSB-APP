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
          background: `linear-gradient(135deg, ${colors.primaryGreen} 0%, ${colors.green} 100%)`,
          borderRadius: 42,
          color: colors.white,
          fontSize: 84,
          fontWeight: 800,
          letterSpacing: -3,
        }}
      >
        HE
      </div>
    ),
    {
      width: 192,
      height: 192,
    }
  );
}
