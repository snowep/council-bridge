import { z } from 'zod/v4';
import { DatabaseInstance } from './database.js';

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

export function createAgentService(dbInstance: DatabaseInstance) {
  return {
    registerAgent(input: z.infer<typeof AgentSchema>): Agent {
      const existing = dbInstance.stmt.getAgentById.get(input.agent_id);
      if (existing) {
        throw new Error(`Agent with ID '${input.agent_id}' already exists`);
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
  };
}

export type AgentService = ReturnType<typeof createAgentService>;