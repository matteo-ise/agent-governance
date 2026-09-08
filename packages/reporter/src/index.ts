import fs from 'fs';
import { AgentAction } from '@agent-governance/core';

export interface ReportSummary {
  totalActions: number;
  approved: number;
  denied: number;
  escalated: number;
  autoApproved: number;
  policyHits: Record<string, number>;
  agents: Record<string, number>;
}

export class ComplianceReporter {
  
  public generateReport(logFilePaths: string[]): ReportSummary {
    const summary: ReportSummary = {
      totalActions: 0,
      approved: 0,
      denied: 0,
      escalated: 0,
      autoApproved: 0,
      policyHits: {},
      agents: {}
    };

    for (const filePath of logFilePaths) {
      if (!fs.existsSync(filePath)) continue;

      const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line) continue;
        try {
          const action = JSON.parse(line) as AgentAction;
          summary.totalActions++;

          // Aggregate decisions
          if (action.decision === 'approved') summary.approved++;
          else if (action.decision === 'denied') summary.denied++;
          else if (action.decision === 'escalated') summary.escalated++;
          else if (action.decision === 'auto_approved') summary.autoApproved++;

          // Aggregate agent usage
          summary.agents[action.agentId] = (summary.agents[action.agentId] || 0) + 1;

          // Aggregate policy hits
          if (action.policyEvaluations) {
            for (const evalResult of action.policyEvaluations) {
              if (evalResult.matched) {
                summary.policyHits[evalResult.policyId] = (summary.policyHits[evalResult.policyId] || 0) + 1;
              }
            }
          }
        } catch (e) {
          console.error('Failed to parse log line', e);
        }
      }
    }

    return summary;
  }

  public generateMarkdownReport(summary: ReportSummary): string {
    return `
# Agent Governance Compliance Report

## Summary
- **Total Actions:** ${summary.totalActions}
- **Approved:** ${summary.approved}
- **Denied:** ${summary.denied}
- **Escalated (Human Review):** ${summary.escalated}
- **Auto-Approved:** ${summary.autoApproved}

## Agent Activity
${Object.entries(summary.agents).map(([agent, count]) => `- **${agent}**: ${count} actions`).join('\n')}

## Policy Hits
${Object.entries(summary.policyHits).map(([policy, count]) => `- **${policy}**: triggered ${count} times`).join('\n')}
    `.trim();
  }
}
