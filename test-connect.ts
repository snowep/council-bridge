import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

const server = new McpServer({ name: 'test', version: '1.0.0' }, { capabilities: { tools: {} } });
const transport1 = new StreamableHTTPServerTransport();
const transport2 = new StreamableHTTPServerTransport();

try {
  await server.connect(transport1);
  console.log('First connect succeeded');
  try {
    await server.connect(transport2);
    console.log('Second connect succeeded');
  } catch(e: any) {
    console.log('Second connect failed:', e.message);
  }
} catch(e: any) {
  console.log('First connect failed:', e.message);
}