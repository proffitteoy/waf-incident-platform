import { buildRedisKey, delRedisKey, setRedisJson } from "../../core/cache/redis";

export type ManagedActionType = "rate_limit" | "block" | "challenge";
export type ManagedActionScope = "ip" | "uri" | "global";

export interface CacheActiveActionInput {
  action_id: string;
  incident_id: string;
  action_type: ManagedActionType;
  scope: ManagedActionScope;
  target: string;
  ttl_seconds: number;
  requested_by?: string | null;
  executed_by?: string | null;
}

const encodeTarget = (target: string) => {
  return Buffer.from(target, "utf8").toString("base64url");
};

export const buildActiveActionKey = (
  scope: ManagedActionScope,
  actionType: ManagedActionType,
  target: string
) => {
  return buildRedisKey("active_action", scope, actionType, encodeTarget(target));
};

export const cacheActiveActionState = async (input: CacheActiveActionInput): Promise<string> => {
  const key = buildActiveActionKey(input.scope, input.action_type, input.target);

  await setRedisJson(
    key,
    {
      ...input,
      cached_at: new Date().toISOString()
    },
    input.ttl_seconds
  );

  return key;
};

export const clearActiveActionState = async (params: {
  scope: ManagedActionScope;
  action_type: ManagedActionType;
  target: string;
}) => {
  const key = buildActiveActionKey(params.scope, params.action_type, params.target);
  const deleted = await delRedisKey(key);

  return { key, deleted };
};
