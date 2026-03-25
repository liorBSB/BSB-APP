import colors from '@/app/colors';

export default function manifest() {
  return {
    name: 'House Efficiency',
    short_name: 'House',
    description: 'Smart Living, Streamlined',
    start_url: '/',
    display: 'standalone',
    background_color: colors.background,
    theme_color: colors.primaryGreen,
    icons: [
      {
        src: '/icons/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
