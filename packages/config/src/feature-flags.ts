export type FeatureFlags = {
  ai: boolean;
  externalIntegrations: boolean;
  featureMfa: boolean;
  featurePasskeys: boolean;
  featurePwa: boolean;
  featureI18n: boolean;
  featureAssistant: boolean;
  featureEnterpriseSso: boolean;
  featureAccessibilityPanel: boolean;
};

function flag(env: NodeJS.ProcessEnv, key: string): boolean {
  return env[key] === "1";
}

export function readFeatureFlags(env: NodeJS.ProcessEnv = process.env): FeatureFlags {
  return {
    ai: flag(env, "FEATURE_AI"),
    externalIntegrations: flag(env, "FEATURE_EXTERNAL_INTEGRATIONS"),
    featureMfa: flag(env, "FEATURE_MFA"),
    featurePasskeys: flag(env, "FEATURE_PASSKEYS"),
    featurePwa: flag(env, "FEATURE_PWA"),
    featureI18n: flag(env, "FEATURE_I18N"),
    featureAssistant: flag(env, "FEATURE_ASSISTANT"),
    featureEnterpriseSso: flag(env, "FEATURE_ENTERPRISE_SSO"),
    featureAccessibilityPanel: flag(env, "FEATURE_ACCESSIBILITY_PANEL"),
  };
}
