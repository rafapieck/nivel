export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-3">
      <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
      <p className="text-lg text-slate-600">{description}</p>
    </section>
  );
}
