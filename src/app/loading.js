import HouseLoader from '@/components/HouseLoader';
import colors from './colors';

export default function GlobalLoading() {
  return (
    <main className="min-h-screen flex items-center justify-center font-body" style={{ background: colors.white }}>
      <HouseLoader size={80} />
    </main>
  );
}
