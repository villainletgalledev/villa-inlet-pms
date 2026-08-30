import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createExpressApp } from '../server/app';

const app = createExpressApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req, res);
}
