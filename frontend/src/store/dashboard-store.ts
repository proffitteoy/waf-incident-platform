export type DashboardCard = {
  title: string;
  value: string;
  description: string;
};

export interface DashboardOverviewResponse {
  range_hours: number;
  summary: {
    request_count: number;
    waf_hits: number;
    blocked_count: number;
  };
  action_stats: {
    action_success: number;
    action_total: number;
  };
  top_attack_sources: Array<{ src_ip: string; count: number }>;
  top_target_uris: Array<{ uri: string; count: number }>;
  top_rules: Array<{ rule_id: string; count: number }>;
}

export const loadingDashboardCards: DashboardCard[] = [
  { title: "Requests (24h)", value: "-", description: "Total ingress requests." },
  { title: "WAF Hits", value: "-", description: "CRS rule hits in current window." },
  { title: "Blocked Requests", value: "-", description: "Requests denied by current rules." },
  { title: "Actions Success", value: "-", description: "Successful mitigation actions." }
];

const formatMetric = (value: number | null | undefined): string => {
  return `${value ?? 0}`;
};

export const buildDashboardCards = (overview: DashboardOverviewResponse): DashboardCard[] => {
  return [
    {
      title: "Requests (24h)",
      value: formatMetric(overview.summary.request_count),
      description: "Total ingress requests."
    },
    {
      title: "WAF Hits",
      value: formatMetric(overview.summary.waf_hits),
      description: "CRS rule hits in current window."
    },
    {
      title: "Blocked Requests",
      value: formatMetric(overview.summary.blocked_count),
      description: "Requests denied by current rules."
    },
    {
      title: "Actions Success",
      value: formatMetric(overview.action_stats.action_success),
      description: "Successful mitigation actions."
    }
  ];
};
