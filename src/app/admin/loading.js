import HouseLoader from '@/components/HouseLoader';

export default function AdminLoading() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-200/60 to-green-100/60 flex items-center justify-center">
      <HouseLoader size={80} />
    </main>
  );
}
