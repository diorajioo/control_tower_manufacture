export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 bg-gray-100 rounded-xl shrink-0" />
        <div className="h-3 bg-gray-100 rounded-full w-28" />
      </div>
      <div className="h-8 bg-gray-100 rounded-lg w-2/3 mb-2" />
      <div className="h-2.5 bg-gray-50 rounded-full w-1/3" />
    </div>
  );
}
