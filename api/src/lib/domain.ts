export function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export function takeoverState(agentId: string) {
  return { ai_active: false, human_active: true, unread_count: 0, assigned_agent_id: agentId } as const;
}

export function resolveState() {
  return { ai_active: true, human_active: false, assigned_agent_id: null, status: 'resolved' } as const;
}

export function isBusinessMediaPath(path: string, businessId: string): boolean {
  return path.startsWith(`${businessId}/`);
}

export function retentionCutoff(now = new Date()): string {
  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

export function machineHeaders(secret: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Machine-Secret': secret };
}
