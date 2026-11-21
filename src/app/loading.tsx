export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" aria-busy>
      <div className="size-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
    </div>
  );
}
