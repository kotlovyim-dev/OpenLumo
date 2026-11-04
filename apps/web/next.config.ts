import { existsSync } from 'node:fs';
import type { NextConfig } from 'next';

const envFile = new URL('../../.env', import.meta.url);
if (existsSync(envFile)) process.loadEnvFile(envFile);

const nextConfig: NextConfig = {
  agentRules: false,
  transpilePackages: ['@openlumo/core', '@openlumo/db'],
  serverExternalPackages: ['pg', 'sharp'],
};

export default nextConfig;
