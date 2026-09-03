#!/usr/bin/env node
/**
 * Call one App Store Connect MCP tool from a shell.
 *
 * The server is registered in .mcp.json for Claude Code and Codex, but a
 * .mcp.json edit only takes effect on client restart, and a wrong path there
 * leaves no way to reach the server at all. This drives dist/index.js over
 * stdio directly, so the tools stay reachable regardless of client state.
 *
 * Usage: node tools/asc-mcp/scripts/call.mjs asc_get_app '{"bundleId":"app.journalio"}'
 */

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, '..', 'dist', 'index.js');

const [tool, rawArgs = '{}'] = process.argv.slice(2);
if (!tool) {
  console.error('usage: call.mjs <tool_name> [json-args]');
  process.exit(1);
}

const child = spawn('node', [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });
const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'asc-cli', version: '0.1.0' },
  },
});

let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      continue;
    }

    if (message.id === 1) {
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: tool, arguments: JSON.parse(rawArgs) },
      });
    } else if (message.id === 2) {
      if (message.error) {
        console.error(JSON.stringify(message.error, null, 2));
        child.kill();
        process.exit(1);
      }
      for (const item of message.result?.content ?? []) {
        console.log(item.text ?? JSON.stringify(item));
      }
      child.kill();
      process.exit(0);
    }
  }
});
