type OverviewPanelProps = {
  title: string;
  value: string;
  description: string;
};

export function OverviewPanel({ title, value, description }: OverviewPanelProps) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      <p className="metric">{value}</p>
      <small>{description}</small>
    </section>
  );
}
