import { Loader2 } from 'lucide-react';

export default function AppLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4" role="status">
      <div className="flex items-center gap-3 rounded-lg bg-white/95 px-5 py-4 shadow-lg">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" aria-hidden="true" />
        <p className="font-medium text-gray-900">Loading Recipe Reborn…</p>
      </div>
    </div>
  );
}
