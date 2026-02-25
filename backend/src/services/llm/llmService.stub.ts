export interface StubIncidentReport {
  attack_chain: Array<{ stage: string; detail: string }>;
  risk_level: "high";
  recommended_actions_high: string[];
}

export const generateIncidentReport = async (_incident: unknown): Promise<StubIncidentReport> => {
  return {
    attack_chain: [
      { stage: "initial_access", detail: "Suspicious payloads hit multiple WAF rules" },
      { stage: "exploitation", detail: "Repeated malicious requests from same source" }
    ],
    risk_level: "high",
    recommended_actions_high: ["block_ip_temp"]
  };
};
