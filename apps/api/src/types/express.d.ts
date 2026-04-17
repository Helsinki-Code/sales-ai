import type { Request } from "express";

export type ApiKeyAuthContext = {
  apiKeyId?: string;
  workspaceId: string;
  orgId: string;
  keyName: string;
  scopes: string[];
};

export type UserAuthContext = {
  userId: string;
  email?: string;
};

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
    auth?: ApiKeyAuthContext;
    userAuth?: UserAuthContext;
  }
}

export type TypedRequest<TBody = unknown, TParams = Record<string, string>, TQuery = Record<string, string>> =
  Request<TParams, unknown, TBody, TQuery>;
