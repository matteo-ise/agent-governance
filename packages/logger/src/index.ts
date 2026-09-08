import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AgentAction } from '@agent-governance/core';

export interface LoggerOptions {
  logDir: string;
  enableHashChain?: boolean;
}

export class DecisionTrailLogger {
  private logFilePath: string;
  private enableHashChain: boolean;
  private lastHash: string = '';

  constructor(options: LoggerOptions) {
    this.enableHashChain = options.enableHashChain ?? true;
    
    if (!fs.existsSync(options.logDir)) {
      fs.mkdirSync(options.logDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    this.logFilePath = path.join(options.logDir, `audit-${dateStr}.jsonl`);

    // Initialize hash chain if needed
    if (this.enableHashChain && fs.existsSync(this.logFilePath)) {
      const lines = fs.readFileSync(this.logFilePath, 'utf8').trim().split('\n');
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        try {
          const parsed = JSON.parse(lastLine);
          this.lastHash = parsed.hash || '';
        } catch (e) {
          // ignore
        }
      }
    }
  }

  public logAction(action: AgentAction): void {
    const payload: any = { ...action };

    if (this.enableHashChain) {
      const dataToHash = this.lastHash + JSON.stringify(action);
      const hash = crypto.createHash('sha256').update(dataToHash).digest('hex');
      payload.hash = hash;
      payload.previousHash = this.lastHash;
      this.lastHash = hash;
    }

    const logLine = JSON.stringify(payload) + '\n';
    
    // Append to file
    fs.appendFileSync(this.logFilePath, logLine, 'utf8');
    
    // Also log to stdout for real-time aggregation (e.g., Datadog, ELK)
    console.log(JSON.stringify({ type: 'audit_log', ...payload }));
  }
}
