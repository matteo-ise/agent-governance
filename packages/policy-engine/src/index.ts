import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { JSONPath } from 'jsonpath-plus';
import { Policy, AgentAction, PolicyCondition, PolicyEvaluation } from '@agent-governance/core';

export class PolicyEngine {
  private policies: Policy[] = [];

  constructor(policyDir?: string) {
    if (policyDir) {
      this.loadPolicies(policyDir);
    }
  }

  public loadPolicies(policyDir: string): void {
    if (!fs.existsSync(policyDir)) return;

    const files = fs.readdirSync(policyDir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    
    this.policies = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(policyDir, file), 'utf8');
      try {
        const parsed = yaml.load(content) as { policies: Policy[] };
        if (parsed && parsed.policies && Array.isArray(parsed.policies)) {
          this.policies.push(...parsed.policies);
        }
      } catch (e) {
        console.error(`Failed to parse policy file ${file}:`, e);
      }
    }

    // Sort by priority descending
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  public evaluate(action: Partial<AgentAction>): { decision: 'allow' | 'deny' | 'require_approval' | 'log_only', evaluations: PolicyEvaluation[] } {
    const evaluations: PolicyEvaluation[] = [];
    let finalDecision: 'allow' | 'deny' | 'require_approval' | 'log_only' = 'allow'; // default allow

    for (const policy of this.policies) {
      if (policy.enabled === false) continue;

      const matched = this.evaluateConditions(policy.conditions, action);
      
      evaluations.push({
        policyId: policy.id,
        matched,
        action: matched ? policy.action : undefined
      });

      if (matched) {
        // If matched, determine if it overrides current decision based on severity
        if (policy.action === 'deny') {
          finalDecision = 'deny';
          break; // Hard deny stops evaluation
        } else if (policy.action === 'require_approval') {
          if (finalDecision !== 'deny') {
            finalDecision = 'require_approval';
          }
        } else if (policy.action === 'log_only') {
          if (finalDecision === 'allow') {
            finalDecision = 'log_only';
          }
        } else if (policy.action === 'allow') {
          // Explicit allow
        }
      }
    }

    return { decision: finalDecision, evaluations };
  }

  private evaluateConditions(conditions: PolicyCondition[], action: unknown): boolean {
    if (!conditions || conditions.length === 0) return true; // No conditions = match all

    for (const condition of conditions) {
      const { field, operator, value } = condition;
      
      // JSONPath evaluation
      const results = JSONPath({ path: field, json: action as object });
      
      if (!results || results.length === 0) {
        return false; // Field not found, condition fails
      }

      const actualValue = results[0];

      let conditionMet = false;
      switch (operator) {
        case 'eq': conditionMet = actualValue === value; break;
        case 'ne': conditionMet = actualValue !== value; break;
        case 'gt': conditionMet = (actualValue as number) > (value as number); break;
        case 'lt': conditionMet = (actualValue as number) < (value as number); break;
        case 'gte': conditionMet = (actualValue as number) >= (value as number); break;
        case 'lte': conditionMet = (actualValue as number) <= (value as number); break;
        case 'contains': 
          if (typeof actualValue === 'string') {
            conditionMet = actualValue.includes(value as string);
          } else if (Array.isArray(actualValue)) {
            conditionMet = actualValue.includes(value);
          }
          break;
        case 'matches':
          if (typeof actualValue === 'string') {
            conditionMet = new RegExp(value as string).test(actualValue);
          }
          break;
      }

      if (!conditionMet) {
        return false; // AND logic: all conditions must match
      }
    }

    return true; // All conditions met
  }
}
