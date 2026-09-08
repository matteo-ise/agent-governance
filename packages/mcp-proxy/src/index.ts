import { PolicyEngine } from '@agent-governance/policy-engine';
import { DecisionTrailLogger } from '@agent-governance/logger';
import { AgentAction } from '@agent-governance/core';
import crypto from 'crypto';

export interface McpProxyOptions {
  policyEngine: PolicyEngine;
  logger: DecisionTrailLogger;
  agentId: string;
  agentName: string;
  principalId: string;
}

export class McpProxy {
  private policyEngine: PolicyEngine;
  private logger: DecisionTrailLogger;
  private agentId: string;
  private agentName: string;
  private principalId: string;

  constructor(options: McpProxyOptions) {
    this.policyEngine = options.policyEngine;
    this.logger = options.logger;
    this.agentId = options.agentId;
    this.agentName = options.agentName;
    this.principalId = options.principalId;
  }

  /**
   * Intercepts an MCP request (e.g., tool call), evaluates policies, and logs the decision.
   * In a real implementation, this would parse JSON-RPC messages from an MCP stream.
   */
  public async handleRequest(
    method: string, 
    params: any, 
    reasoning: string = 'No reasoning provided'
  ): Promise<{ allowed: boolean; decision: string; error?: string }> {
    
    const startTime = Date.now();
    
    // Construct the action context for evaluation
    const actionId = crypto.randomUUID();
    const action: Partial<AgentAction> = {
      id: actionId,
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      agentName: this.agentName,
      principalId: this.principalId,
      action: method,
      input: params,
      reasoning: reasoning
    };

    // Evaluate policies
    const result = this.policyEngine.evaluate(action);
    
    const duration = Date.now() - startTime;

    // Map policy engine decision to AgentAction decision
    let finalDecision: AgentAction['decision'] = 'approved';
    let allowed = true;

    if (result.decision === 'deny') {
      finalDecision = 'denied';
      allowed = false;
    } else if (result.decision === 'require_approval') {
      finalDecision = 'escalated';
      allowed = false; // Blocked until human approves
    }

    // Complete the action record for logging
    const fullAction: AgentAction = {
      ...action,
      id: actionId,
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      agentName: this.agentName,
      principalId: this.principalId,
      action: method,
      target: params?.target || 'unknown',
      input: params,
      output: allowed ? 'Pending execution' : `Blocked: ${finalDecision}`,
      reasoning: reasoning,
      context: {},
      decision: finalDecision,
      policyEvaluations: result.evaluations,
      duration_ms: duration,
      metadata: {}
    };

    // Log the decision trail
    this.logger.logAction(fullAction);

    if (!allowed) {
      return { 
        allowed: false, 
        decision: finalDecision, 
        error: `Action blocked by governance policy. Decision: ${finalDecision}` 
      };
    }

    return { allowed: true, decision: finalDecision };
  }
}
