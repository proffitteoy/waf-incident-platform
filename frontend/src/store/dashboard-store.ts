export type DashboardCard = {
  title: string;
  value: string;
  description: string;
};

export const dashboardCards: DashboardCard[] = [
  { title: "Requests (24h)", value: "-", description: "Total ingress requests." },
  { title: "WAF Hits", value: "-", description: "CRS rule hits in current window." },
  { title: "Incidents Open", value: "-", description: "Incidents pending handling." },
  { title: "Actions Success", value: "-", description: "Successful mitigation actions." }
];
