// Hermes Bridge Adapter
// Translates between Hermes agent messaging format and Council Bridge API
// This allows Hermes agents to communicate through the Council Bridge

import { DatabaseInstance } from '../database.js';
import { createMessageService } from '../communication/messages.js';
import { createAgentService } from '../communication/agents.js';
import crypto from 'crypto';

export interface HermesBridgeAdapters {
  // Register Hermes agent with Council Bridge
  registerHermesAgent: (hermesId: string, displayName: string) => Promise<string>;

  // Convert Hermes session to Council Bridge session token
  hermesSessionToToken: (hermesSessionId: string) => Promise<string>;

  // Send message from Hermes through Council Bridge
  hermesSendMessage: (fromHermesId: string, toCouncilId: string, content: string) => Promise<any>;

  // Receive messages intended for Hermes
  getMessagesForHermes: (hermesId: string, limit?: number) => Promise<any[]>;
}

export function createHermesBridgeAdapter(dbInstance: DatabaseInstance): HermesBridgeAdapters {
  const agentService = createAgentService(dbInstance);
  const messageService = createMessageService(dbInstance, agentService);

  return {
    // Register a Hermes agent in the Council Bridge
    async registerHermesAgent(hermesId: string, displayName: string): Promise<string> {
      // Check if agent already exists
      const existing = agentService.getAgent(hermesId);
      if (existing) {
        return hermesId;
      }

      // Create a new agent entry for Hermes runtime
      const agent = agentService.registerAgent({
        agent_id: hermesId,
        display_name: displayName,
        runtime: 'hermes',
      });

      return agent.agent_id;
    },

    // Convert Hermes session to a Council Bridge-compatible session token
    async hermesSessionToToken(hermesSessionId: string): Promise<string> {
      // Get agent for this Hermes session
      const agent = agentService.getAgent(hermesSessionId);

      if (!agent) {
        throw new Error(`No agent registered for Hermes session: ${hermesSessionId}`);
      }

      // Generate a session token for the agent
      const { generateSessionToken } = await import('../auth/session.js');
      return generateSessionToken({
        owner_type: 'staff',
        owner_id: agent.agent_id,
        runtime: 'hermes',
        client_ip: 'hermes-bridge',
        user_agent: 'hermes-bridge-adapter'
      });
    },

    // Send a message from Hermes through Council Bridge
    async hermesSendMessage(fromHermesId: string, toCouncilId: string, content: string): Promise<any> {
      // Resolve Hermes ID to Council Bridge agent
      const fromAgent = agentService.getAgent(fromHermesId);
      if (!fromAgent) {
        throw new Error(`Hermes agent not found: ${fromHermesId}`);
      }

      // Send message via Council Bridge
      return messageService.sendMessage({
        sender_id: fromAgent.agent_id,
        recipient_id: toCouncilId,
        content: content
      });
    },

    // Get messages intended for Hermes
    async getMessagesForHermes(hermesId: string, limit: number = 50): Promise<any[]> {
      const agent = agentService.getAgent(hermesId);
      if (!agent) {
        throw new Error(`Hermes agent not found: ${hermesId}`);
      }

      // Get messages for this agent
      try {
        const db = dbInstance;
        const msgs = db.query(
          'SELECT * FROM messages WHERE recipient_id = ? ORDER BY created_at DESC LIMIT ?',
          [agent.agent_id, limit]
        );
        return msgs;
      } catch {
        return [];
      }
    }
  };
}

// Hermes-to-Council Bridge HTTP adapter
export async function handleHermesWebhook(req: any, db: DatabaseInstance): Promise<Response> {
  const adapter = createHermesBridgeAdapter(db);

  try {
    const event = req.body;

    switch (event.type) {
      case 'hermes_message':
        // Handle incoming message from Hermes webhook
        const result = await adapter.hermesSendMessage(
          event.from_hermes_id,
          event.to_council_id,
          event.content
        );
        return new Response(JSON.stringify({ success: true, message_id: result?.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'hermes_register':
        // Handle agent registration
        const agentId = await adapter.registerHermesAgent(event.hermes_id, event.display_name);
        return new Response(JSON.stringify({ success: true, agent_id: agentId }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Unknown event type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}