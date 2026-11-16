import { z } from 'zod/v4';
import { DatabaseInstance } from '../database.js';
import { randomUUID } from 'node:crypto';

export const AgentSchema = z.object({
  agent_id: z.string().min(1).max(255),
  display_name: z.string().min(1).max(255),
  runtime: z.string().min(1).max(255),
});

export type Agent = z.infer<typeof AgentSchema> & {
  id: string;
  created_at: string;
  updated_at: string;
};

export interface IdentityRegistrySyncResult {
  registered: string[];
  skipped: string[];
  errors: Array<{ id: string; error: string }>;
}

export function createAgentService(dbInstance: DatabaseInstance) {
  return {
    registerAgent(input: z.infer<typeof AgentSchema>): Agent {
      // Idempotent: use INSERT OR IGNORE behavior via explicit check
      const existing = dbInstance.stmt.getAgentById.get(input.agent_id);
      if (existing) {
        return existing as Agent;
      }

      const id = dbInstance.generateId();
      dbInstance.stmt.insertAgent.run(id, input.agent_id, input.display_name, input.runtime);

      const agent = dbInstance.stmt.getAgentById.get(input.agent_id) as Agent;
      return agent;
    },

    listAgents(): Agent[] {
      return dbInstance.stmt.listAgents.all() as Agent[];
    },

    getAgent(agentId: string): Agent | undefined {
      return dbInstance.stmt.getAgentById.get(agentId) as Agent | undefined;
    },

    agentExists(agentId: string): boolean {
      return !!dbInstance.stmt.getAgentById.get(agentId);
    },

    // Register Founder as the canonical communication identity
    registerFounder(): Agent {
      const founderId = 'founder';
      const founderName = 'Founder';
      return this.registerAgent({
        agent_id: founderId,
        display_name: founderName,
        runtime: 'claude',
      });
    },

    // Synchronize a staff agent from staff_agents table to agents table
    syncStaffAgent(staffId: string): Agent {
      const staffResult = dbInstance.query('SELECT * FROM staff_agents WHERE staff_id = ?', [staffId]);
      if (staffResult.length === 0) {
        throw new Error(`Staff agent '${staffId}' not found in staff_agents table`);
      }
      const staff = staffResult[0] as any;

      // Check if already registered
      let agent = this.getAgent(staffId);
      if (agent) {
        return agent; // Already registered, idempotent
      }

      // Get preferred runtime - use first from runtime_instances array
      let runtime = 'hermes';
      try {
        const runtimes = JSON.parse(staff.runtime_instances || '[]');
        if (runtimes.length > 0) {
          runtime = runtimes[0];
        }
      } catch {
        // Default to hermes
      }

      return this.registerAgent({
        agent_id: staffId,
        display_name: staff.name,
        runtime,
      });
    },

    // Synchronize division head from divisions table to agents table
    syncDivisionHead(divisionId: string): Agent | null {
      const divisionResult = dbInstance.query('SELECT * FROM divisions WHERE division_id = ?', [divisionId]);
      if (divisionResult.length === 0) {
        throw new Error(`Division '${divisionId}' not found in divisions table`);
      }
      const division = divisionResult[0] as any;

      if (!division.head_staff_id) {
        return null; // No division head assigned
      }

      return this.syncStaffAgent(division.head_staff_id);
    },

    // Sync all active staff agents from staff_agents to agents
    syncAllStaffAgents(): IdentityRegistrySyncResult {
      const result: IdentityRegistrySyncResult = {
        registered: [],
        skipped: [],
        errors: [],
      };

      const staffResult = dbInstance.query(
        "SELECT * FROM staff_agents WHERE status = 'active' OR status = 'inactive'",
        []
      );

      for (const row of staffResult as any[]) {
        try {
          const agent = this.getAgent(row.staff_id);
          if (agent) {
            result.skipped.push(row.staff_id);
          } else {
            this.syncStaffAgent(row.staff_id);
            result.registered.push(row.staff_id);
          }
        } catch (error) {
          result.errors.push({
            id: row.staff_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    },

    // Sync all division heads from divisions to agents
    syncAllDivisionHeads(): IdentityRegistrySyncResult {
      const result: IdentityRegistrySyncResult = {
        registered: [],
        skipped: [],
        errors: [],
      };

      const divisionResult = dbInstance.query(
        "SELECT * FROM divisions WHERE head_staff_id IS NOT NULL",
        []
      );

      for (const row of divisionResult as any[]) {
        try {
          // Division heads are synced via their staff agent
          const agent = this.getAgent(row.head_staff_id);
          if (agent) {
            result.skipped.push(row.head_staff_id);
          } else {
            this.syncDivisionHead(row.division_id);
            result.registered.push(row.head_staff_id);
          }
        } catch (error) {
          result.errors.push({
            id: row.head_staff_id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return result;
    },

    // Full synchronization of identity registry
    syncIdentityRegistry(): IdentityRegistrySyncResult {
      const result: IdentityRegistrySyncResult = {
        registered: [],
        skipped: [],
        errors: [],
      };

      // Ensure Founder exists first
      try {
        const founderAgent = this.registerFounder();
        result.registered.push(founderAgent.agent_id);
      } catch (error) {
        result.errors.push({
          id: 'founder',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Sync staff agents
      const staffResult = this.syncAllStaffAgents();
      result.registered.push(...staffResult.registered);
      result.skipped.push(...staffResult.skipped);
      result.errors.push(...staffResult.errors);

      // Sync division heads
      const divisionResult = this.syncAllDivisionHeads();
      // Don't double-count if already registered via staff
      for (const id of divisionResult.registered) {
        if (!result.registered.includes(id) && !result.skipped.includes(id)) {
          result.registered.push(id);
        }
      }
      for (const id of divisionResult.skipped) {
        if (!result.skipped.includes(id)) {
          result.skipped.push(id);
        }
      }
      for (const err of divisionResult.errors) {
        if (!result.errors.some(e => e.id === err.id)) {
            result.errors.push(err);
        }
      }

      return result;
    },
  };
}

export type AgentService = ReturnType<typeof createAgentService>;