export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-10 w-80" />
      <div className="skeleton h-20" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-64" />
        ))}
      </div>
    </div>
  );
}
