import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Context } from '@deepseek-ai/cordis';
import ToolRuntime from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import * as plugin from '../../src/plugin.mjs';

test('published DSH runtime registers, dispatches and disposes the plugin', async () => {
  const ctx = new Context();
  try {
    await ctx.plugin(SystemPrompt);
    await ctx.plugin(ToolRuntime);
    const fiber = await ctx.plugin(plugin, { workspaceRoot: fileURLToPath(new URL('../fixtures', import.meta.url)) });
    assert.ok(ctx.tools.schemas().some(t => t.name === 'pdf_page_evidence'));
    const result = await ctx.tools.execute({ signal: new AbortController().signal, callId: 'page-evidence-smoke', name: 'pdf_page_evidence', arguments: { path: 'mixed-pages.pdf', query: 'Hangzhou' } });
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.equal(result.value.matches[0].page, 3);
    const denied = await ctx.tools.execute({ signal: new AbortController().signal, callId: 'outside-root', name: 'pdf_page_evidence', arguments: { path: '../core.test.mjs' } });
    assert.equal(denied.isError, true);
    await fiber.dispose();
    assert.ok(!ctx.tools.schemas().some(t => t.name === 'pdf_page_evidence'));
  } finally { await ctx.fiber.dispose(); }
});
