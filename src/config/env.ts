import dotenv from 'dotenv';
dotenv.config();

export const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);

export const config = {
  port: Number(process.env.PORT) || 5500,
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production' || isVercel,
  adminApiKey: process.env.ADMIN_API_KEY || 'anisora_admin_secret_key_2026',
  apiPrefix: '/api/v1',
};
