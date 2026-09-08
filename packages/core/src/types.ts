export interface PolicyEvaluation {
  policyId: string;
  matched: boolean;
  action?: 'allow' | 'deny' | 'require_approval' | 'log_only';
}

export interface AgentAction {
  id: string;
  timestamp: string; // ISO8601
  agentId: string;
  agentName: string;
  principalId: string;
  action: string;
  target: string;
  input: unknown;
  output: unknown;
  reasoning: string;
  context: Record<string, unknown>;
  decision: 'approved' | 'denied' | 'escalated' | 'auto_approved';
  policyEvaluations: PolicyEvaluation[];
  duration_ms: number;
  metadata: Record<string, unknown>;
}

export interface PolicyCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'matches';
  value: unknown;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  conditions: PolicyCondition[];
  action: 'allow' | 'deny' | 'require_approval' | 'log_only';
  priority: number;
  enabled: boolean;
}
