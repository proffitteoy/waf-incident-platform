import { OverviewPanel } from "../components/OverviewPanel";
import { dashboardCards } from "../store/dashboard-store";

export function DashboardPage() {
  return (
    <main className="page">
      <h1 className="title">WAF Incident Dashboard</h1>
      <p className="subtitle">
        Architecture scaffold aligned with the incident lifecycle pipeline.
      </p>

      <div className="grid">
        {dashboardCards.map((card) => (
          <OverviewPanel
            key={card.title}
            title={card.title}
            value={card.value}
            description={card.description}
          />
        ))}
      </div>
    </main>
  );
}
