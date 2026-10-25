export default function MlTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-sm font-semibold text-slate-800">
      {children}
    </span>
  );
}
