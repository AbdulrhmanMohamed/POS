import { test as base, _electron as electron } from '@playwright/test';
import { spawn } from 'child_process';

const ROOT = process.cwd();

function startVite() {
  return new Promise((resolvePromise, reject) => {
    const proc = spawn('npx', ['vite', '--port', '3000', '--strictPort'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let started = false;
    const onData = (data) => {
      const text = data.toString();
      if (!started && text.includes('ready in')) {
        started = true;
        setTimeout(() => resolvePromise(proc), 500);
      }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (!started) reject(new Error(`Vite exited with code ${code}`));
    });

    setTimeout(() => {
      if (!started) reject(new Error('Vite start timeout'));
    }, 15000);
  });
}

export const test = base.extend({
  electronApp: async ({}, use) => {
    let viteProc;
    try {
      viteProc = await startVite();
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.error('Failed to start Vite:', err.message);
    }

    const electronApp = await electron.launch({
      args: ['.'],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    await use(electronApp);

    await electronApp.close();
    if (viteProc) {
      viteProc.kill();
    }
  },

  window: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow();
    try {
      await window.waitForLoadState('domcontentloaded', { timeout: 15000 });
    } catch {
      const window2 = await electronApp.firstWindow();
      await window2.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await use(window2);
      return;
    }
    await use(window);
  },
});

export { expect } from '@playwright/test';