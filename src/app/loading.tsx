export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-80 animate-pulse rounded bg-slate-200" />
      <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
