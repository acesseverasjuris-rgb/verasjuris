/**
 * Nomes de eventos de plataforma — segurança, privacidade, integrações e assistente (Etapas 26–33).
 */

export const SECURITY_EVENTS = {
  LOGIN_FAILURE: "security.login_failure",
  MFA_ENABLED: "security.mfa_enabled",
  MFA_DISABLED: "security.mfa_disabled",
  MFA_FAILURE: "security.mfa_failure",
  PASSKEY_REGISTERED: "security.passkey_registered",
  SESSION_REVOKED: "security.session_revoked",
  DEVICE_TRUSTED: "security.device_trusted",
  DEVICE_REVOKED: "security.device_revoked",
  ALERT_OPENED: "security.alert_opened",
  ALERT_RESOLVED: "security.alert_resolved",
  VULNERABILITY_RECORDED: "security.vulnerability_recorded",
  PENTEST_RECORDED: "security.pentest_recorded",
} as const;

export type SecurityEventName = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

export const PRIVACY_EVENTS = {
  CONSENT_RECORDED: "privacy.consent_recorded",
  DSR_RECEIVED: "privacy.dsr_received",
  DSR_COMPLETED: "privacy.dsr_completed",
  INCIDENT_REPORTED: "privacy.incident_reported",
  RETENTION_POLICY_UPDATED: "privacy.retention_policy_updated",
  OPERATOR_REGISTERED: "privacy.operator_registered",
} as const;

export type PrivacyEventName = (typeof PRIVACY_EVENTS)[keyof typeof PRIVACY_EVENTS];

export const INTEGRATION_EVENTS = {
  PROVIDER_REGISTERED: "integration.provider_registered",
  CREDENTIAL_ROTATED: "integration.credential_rotated",
  SYNC_STARTED: "integration.sync_started",
  SYNC_COMPLETED: "integration.sync_completed",
  SYNC_FAILED: "integration.sync_failed",
  WEBHOOK_RECEIVED: "integration.webhook_received",
  WEBHOOK_REJECTED: "integration.webhook_rejected",
  WEBHOOK_DELIVERED: "integration.webhook_delivered",
} as const;

export type IntegrationEventName = (typeof INTEGRATION_EVENTS)[keyof typeof INTEGRATION_EVENTS];

export const ASSISTANT_EVENTS = {
  SESSION_STARTED: "assistant.session_started",
  MESSAGE_SENT: "assistant.message_sent",
  MESSAGE_RECEIVED: "assistant.message_received",
  CRITICAL_ACTION_BLOCKED: "assistant.critical_action_blocked",
  SESSION_ARCHIVED: "assistant.session_archived",
} as const;

export type AssistantEventName = (typeof ASSISTANT_EVENTS)[keyof typeof ASSISTANT_EVENTS];

export const ENTERPRISE_EVENTS = {
  SSO_CONFIGURED: "enterprise.sso_configured",
  SSO_LOGIN: "enterprise.sso_login",
  SCIM_USER_PROVISIONED: "enterprise.scim_user_provisioned",
  SCIM_USER_DEACTIVATED: "enterprise.scim_user_deactivated",
  SLA_UPDATED: "enterprise.sla_updated",
} as const;

export type EnterpriseEventName = (typeof ENTERPRISE_EVENTS)[keyof typeof ENTERPRISE_EVENTS];

export const PLATFORM_EVENT_NAMES = [
  ...Object.values(SECURITY_EVENTS),
  ...Object.values(PRIVACY_EVENTS),
  ...Object.values(INTEGRATION_EVENTS),
  ...Object.values(ASSISTANT_EVENTS),
  ...Object.values(ENTERPRISE_EVENTS),
] as const;

export type PlatformEventName = (typeof PLATFORM_EVENT_NAMES)[number];
