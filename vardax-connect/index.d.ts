/**
 * TypeScript definitions for @vardax/connect
 */

import { Request, Response, NextFunction } from 'express';

export interface VARDAxConfig {
  host: string;
  port: string;
  protocol: string;
  apiKey: string;
  mode: 'monitor' | 'protect';
  timeout: number;
  blockThreshold: number;
  challengeThreshold: number;
  debug: boolean;
  failOpen: boolean;
  customBlockPage: string | null;
}

export interface VARDAxAnalysis {
  allowed: boolean;
  score: number;
  explanations: any[];
  requestId: string;
  error?: string;
}

export interface VARDAxRequestData {
  request_id: string;
  timestamp: string;
  client_ip: string;
  client_port: number;
  method: string;
  uri: string;
  query_string: string | null;
  protocol: string;
  user_agent: string | null;
  referer: string | null;
  content_type: string | null;
  content_length: number;
  has_auth_header: boolean;
  has_cookie: boolean;
  body_length: number;
  origin: string | null;
  host: string | null;
}

export interface VARDAxClient {
  analyze(requestData: VARDAxRequestData): Promise<VARDAxAnalysis>;
  getStatus(): Promise<{ connected: boolean; status?: any; error?: string }>;
  getConfig(): VARDAxConfig;
}

export type VARDAxMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

/**
 * Create VARDAx middleware from connection string
 */
export default function createMiddleware(
  connectionString: string,
  options?: Partial<VARDAxConfig>
): VARDAxMiddleware;

/**
 * Create VARDAx middleware from connection string
 */
export function createMiddleware(
  connectionString: string,
  options?: Partial<VARDAxConfig>
): VARDAxMiddleware;

/**
 * Create VARDAx client for manual analysis
 */
export function createClient(connectionString: string): VARDAxClient;

/**
 * Parse VARDAx connection string
 */
export function parseConnectionString(connectionString: string): VARDAxConfig;

/**
 * Extract request features
 */
export function extractFeatures(req: Request): VARDAxRequestData;

declare global {
  namespace Express {
    interface Request {
      vardax?: {
        score: number;
        explanations: any[];
        requestId: string;
      };
    }
  }
}
