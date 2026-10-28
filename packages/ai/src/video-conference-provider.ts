import { AppError } from "@verasjuris/types";

/**
 * Salas de vídeo para consultas online (modo VIDEO).
 */

export type VideoConferenceHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CreateVideoRoomInput = {
  consultationId: string;
  title?: string;
  scheduledAt?: string | null;
  expiresAt?: string | null;
  hostUserId?: string;
  signal?: AbortSignal;
};

export type VideoRoom = {
  externalRoomId: string | null;
  joinUrl: string | null;
  hostUrl: string | null;
  providerKey: string;
  status: "ready" | "active" | "ended" | "not_configured" | "failed";
};

export interface VideoConferenceProvider {
  readonly id: string;
  createRoom(input: CreateVideoRoomInput): Promise<VideoRoom>;
  getRoom(externalRoomId: string, signal?: AbortSignal): Promise<VideoRoom>;
  endRoom(externalRoomId: string, signal?: AbortSignal): Promise<VideoRoom>;
  healthCheck(): Promise<VideoConferenceHealth>;
}

const MESSAGE =
  "Nenhum provedor de videoconferência está configurado. Use outro modo de consulta ou agenda manual.";

export class NotConfiguredVideoConferenceProvider implements VideoConferenceProvider {
  readonly id = "not_configured";

  createRoom(_input: CreateVideoRoomInput): Promise<VideoRoom> {
    return Promise.resolve({
      externalRoomId: null,
      joinUrl: null,
      hostUrl: null,
      providerKey: "not_configured",
      status: "not_configured",
    });
  }

  getRoom(_externalRoomId: string): Promise<VideoRoom> {
    return Promise.resolve({
      externalRoomId: null,
      joinUrl: null,
      hostUrl: null,
      providerKey: "not_configured",
      status: "not_configured",
    });
  }

  endRoom(_externalRoomId: string): Promise<VideoRoom> {
    return Promise.reject(new AppError("VIDEO_CONFERENCE_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<VideoConferenceHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de videoconferência não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
