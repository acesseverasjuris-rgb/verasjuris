import { AppError } from "@verasjuris/types";

/**
 * Aulas ao vivo (sala / streaming síncrono).
 * Default: not_configured — não inventa join URL nem presença.
 * Distinto de VideoConferenceProvider (consultas online).
 */

export type LiveClassHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CreateLiveClassSessionInput = {
  lessonId?: string;
  courseId?: string;
  title: string;
  scheduledAt?: string | null;
  endsAt?: string | null;
  hostUserId?: string;
  maxParticipants?: number;
  recordingEnabled?: boolean;
  signal?: AbortSignal;
};

export type LiveClassSession = {
  externalSessionId: string | null;
  providerKey: string;
  status: "scheduled" | "live" | "ended" | "cancelled" | "failed" | "not_configured";
  joinUrl: string | null;
  hostUrl: string | null;
  scheduledAt?: string | null;
  endsAt?: string | null;
};

export type LiveClassAttendanceSnapshot = {
  externalSessionId: string | null;
  providerKey: string;
  status: "available" | "unavailable" | "not_configured";
  participantCount: number | null;
  attendees: readonly { externalParticipantId: string; joinedAt?: string | null }[];
};

export interface LiveClassProvider {
  readonly id: string;
  createSession(input: CreateLiveClassSessionInput): Promise<LiveClassSession>;
  getSession(externalSessionId: string, signal?: AbortSignal): Promise<LiveClassSession>;
  endSession(externalSessionId: string, signal?: AbortSignal): Promise<LiveClassSession>;
  getAttendance(
    externalSessionId: string,
    signal?: AbortSignal,
  ): Promise<LiveClassAttendanceSnapshot>;
  healthCheck(): Promise<LiveClassHealth>;
}

const MESSAGE =
  "Nenhum provedor de aula ao vivo está configurado. Agende aula presencial/manual ou use outro canal.";

function notConfiguredSession(): LiveClassSession {
  return {
    externalSessionId: null,
    providerKey: "not_configured",
    status: "not_configured",
    joinUrl: null,
    hostUrl: null,
    scheduledAt: null,
    endsAt: null,
  };
}

export class NotConfiguredLiveClassProvider implements LiveClassProvider {
  readonly id = "not_configured";

  createSession(_input: CreateLiveClassSessionInput): Promise<LiveClassSession> {
    return Promise.resolve(notConfiguredSession());
  }

  getSession(_externalSessionId: string): Promise<LiveClassSession> {
    return Promise.resolve(notConfiguredSession());
  }

  endSession(_externalSessionId: string): Promise<LiveClassSession> {
    return Promise.reject(new AppError("LIVE_CLASS_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  getAttendance(_externalSessionId: string): Promise<LiveClassAttendanceSnapshot> {
    return Promise.resolve({
      externalSessionId: null,
      providerKey: "not_configured",
      status: "not_configured",
      participantCount: null,
      attendees: [],
    });
  }

  healthCheck(): Promise<LiveClassHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de aula ao vivo não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
