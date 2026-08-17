#!/usr/bin/env node
/**
 * Read-only App Store Connect MCP server for Journal.IO.
 *
 * Exposes the listing — app info, versions, localized metadata, screenshots and
 * customer reviews — to Claude Code and Codex. Every tool is a GET; nothing here
 * can mutate a live App Store page.
 *
 * stdout belongs to the MCP transport, so all diagnostics go to stderr.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { AppStoreConnectClient, loadConfig } from './asc.js';

const client = new AppStoreConnectClient(await loadConfig());

interface ToolDef {
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  handler: (args: any) => Promise<unknown>;
}

const tools: Record<string, ToolDef> = {
  asc_list_apps: {
    description:
      'List every app on the account, with id, name, bundleId, SKU and primary locale. Start here to get an appId.',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const apps = await client.getAll('/v1/apps');
      return apps.map((app) => ({ id: app.id, ...app.attributes }));
    },
  },

  asc_get_app: {
    description:
      'Get one app by bundle ID (defaults to app.journalio, the Journal.IO bundle) or by appId.',
    inputSchema: {
      type: 'object',
      properties: {
        bundleId: { type: 'string', description: 'Bundle identifier, e.g. app.journalio' },
        appId: { type: 'string', description: 'App Store Connect app id, if already known' },
      },
    },
    handler: async ({ bundleId, appId }: { bundleId?: string; appId?: string }) => {
      if (appId) {
        const one = await client.get(`/v1/apps/${appId}`);
        return { id: one.data.id, ...one.data.attributes };
      }
      const apps = await client.getAll('/v1/apps', {
        'filter[bundleId]': bundleId ?? 'app.journalio',
      });
      if (apps.length === 0) {
        return { found: false, message: `No app matched bundleId ${bundleId ?? 'app.journalio'}` };
      }
      return { id: apps[0].id, ...apps[0].attributes };
    },
  },

  asc_list_versions: {
    description:
      'List App Store versions for an app — version string, platform, state and release type. Use this to find the version whose metadata you want.',
    inputSchema: {
      type: 'object',
      properties: { appId: { type: 'string' } },
      required: ['appId'],
    },
    handler: async ({ appId }: { appId: string }) => {
      const versions = await client.getAll(`/v1/apps/${appId}/appStoreVersions`);
      return versions.map((v) => ({ id: v.id, ...v.attributes }));
    },
  },

  asc_get_app_info_localizations: {
    description:
      'Get the app-level localized metadata: NAME and SUBTITLE, plus privacy policy URL. Note that name and subtitle live here, not on the version — these are the fields that actually carry ASO keyword weight.',
    inputSchema: {
      type: 'object',
      properties: { appId: { type: 'string' } },
      required: ['appId'],
    },
    handler: async ({ appId }: { appId: string }) => {
      const infos = await client.getAll(`/v1/apps/${appId}/appInfos`);
      const results = [];
      for (const info of infos) {
        const locs = await client.getAll(`/v1/appInfos/${info.id}/appInfoLocalizations`);
        results.push({
          appInfoId: info.id,
          state: info.attributes?.appStoreState,
          localizations: locs.map((l) => ({ id: l.id, ...l.attributes })),
        });
      }
      return results;
    },
  },

  asc_get_version_localizations: {
    description:
      'Get version-level localized metadata: description, keywords, promotional text, what’s new, marketing and support URLs. Returns a localizationId needed for the screenshot tools.',
    inputSchema: {
      type: 'object',
      properties: { versionId: { type: 'string' } },
      required: ['versionId'],
    },
    handler: async ({ versionId }: { versionId: string }) => {
      const locs = await client.getAll(
        `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
      );
      return locs.map((l) => ({ id: l.id, ...l.attributes }));
    },
  },

  asc_list_screenshots: {
    description:
      'List the screenshot sets and screenshots for a version localization, including display type (e.g. APP_IPHONE_67), ordering, dimensions and a resolved download URL for each image.',
    inputSchema: {
      type: 'object',
      properties: { localizationId: { type: 'string' } },
      required: ['localizationId'],
    },
    handler: async ({ localizationId }: { localizationId: string }) => {
      const sets = await client.getAll(
        `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`,
      );
      const results = [];
      for (const set of sets) {
        const shots = await client.getAll(`/v1/appScreenshotSets/${set.id}/appScreenshots`);
        results.push({
          setId: set.id,
          displayType: set.attributes?.screenshotDisplayType,
          screenshots: shots.map((s) => ({
            id: s.id,
            fileName: s.attributes?.fileName,
            width: s.attributes?.imageAsset?.width,
            height: s.attributes?.imageAsset?.height,
            downloadUrl: AppStoreConnectClient.renderImageAssetUrl(s.attributes?.imageAsset),
          })),
        });
      }
      return results;
    },
  },

  asc_download_screenshots: {
    description:
      'Download every screenshot for a version localization to a local directory, so the current set can be inspected directly.',
    inputSchema: {
      type: 'object',
      properties: {
        localizationId: { type: 'string' },
        outputDir: { type: 'string', description: 'Absolute path to write PNGs into' },
      },
      required: ['localizationId', 'outputDir'],
    },
    handler: async ({ localizationId, outputDir }: { localizationId: string; outputDir: string }) => {
      const sets = await client.getAll(
        `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets`,
      );
      await mkdir(outputDir, { recursive: true });
      const written: string[] = [];

      for (const set of sets) {
        const displayType = set.attributes?.screenshotDisplayType ?? 'UNKNOWN';
        const shots = await client.getAll(`/v1/appScreenshotSets/${set.id}/appScreenshots`);
        for (const [index, shot] of shots.entries()) {
          const url = AppStoreConnectClient.renderImageAssetUrl(shot.attributes?.imageAsset);
          if (!url) continue;
          const response = await fetch(url);
          if (!response.ok) continue;
          const path = join(outputDir, `${displayType}-${String(index + 1).padStart(2, '0')}.png`);
          await writeFile(path, Buffer.from(await response.arrayBuffer()));
          written.push(path);
        }
      }

      return { written, count: written.length };
    },
  },

  asc_list_customer_reviews: {
    description:
      'List customer reviews for an app — rating, title, body, reviewer nickname and territory. Use for genuine testimonial copy; never invent review text.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string' },
        limit: { type: 'number', description: 'Max reviews to return (default 50)' },
      },
      required: ['appId'],
    },
    handler: async ({ appId, limit }: { appId: string; limit?: number }) => {
      const reviews = await client.getAll(`/v1/apps/${appId}/customerReviews`, {
        sort: '-createdDate',
      });
      return reviews.slice(0, limit ?? 50).map((r) => ({ id: r.id, ...r.attributes }));
    },
  },
};

const server = new Server(
  { name: 'app-store-connect', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.entries(tools).map(([name, def]) => ({
    name,
    description: def.description,
    inputSchema: def.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const tool = tools[request.params.name];
  if (!tool) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${request.params.name}` }],
      isError: true,
    };
  }

  try {
    const result = await tool.handler(request.params.arguments ?? {});
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return {
      content: [{ type: 'text' as const, text: (error as Error).message }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error('app-store-connect MCP server ready (read-only)');
}

main().catch((error) => {
  console.error(`app-store-connect MCP server failed to start: ${error.message}`);
  process.exit(1);
});
