import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);

let expressApp: any = null;

function getApp() {
  if (!expressApp) {
    let appModule: any;

    const candidatePaths = [
      path.join(process.cwd(), 'dist', 'server-app.cjs'),
      path.join('/var/task', 'dist', 'server-app.cjs'),
      new URL('../dist/server-app.cjs', import.meta.url).pathname,
    ];

    for (const candidate of candidatePaths) {
      try {
        if (fs.existsSync(candidate)) {
          appModule = require(candidate);
          break;
        }
      } catch {
        // continue to next path
      }
    }

    if (!appModule) {
      try {
        appModule = require('../dist/server-app.cjs');
      } catch (err: any) {
        throw new Error(
          `Failed to load pre-bundled server-app.cjs. Checked paths: ${candidatePaths.join(', ')}. Details: ${err?.message}`
        );
      }
    }

    expressApp = appModule.createExpressApp();
  }
  return expressApp;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  const app = getApp();
  return app(req, res);
}
