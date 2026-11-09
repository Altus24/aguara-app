export function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-11 animate-pulse rounded-xl bg-stone-200/70" />
      <div className="h-48 animate-pulse rounded-2xl bg-stone-200/70" />
    </div>
  );
}

export function FormSkeleton() {
  return <div className="h-96 animate-pulse rounded-2xl bg-stone-200/70" aria-hidden="true" />;
}

export function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-8 w-32 animate-pulse rounded-lg bg-stone-200/70" />
      <div className="h-40 animate-pulse rounded-2xl bg-stone-200/70" />
      <div className="h-64 animate-pulse rounded-2xl bg-stone-200/70" />
    </div>
  );
}
