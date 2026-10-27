export type FeatureFlags = {
  ai: boolean;
  externalIntegrations: boolean;
};

export function readFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    ai: env.FEATURE_AI === "1",
    externalIntegrations: env.FEATURE_EXTERNAL_INTEGRATIONS === "1",
  };
}
