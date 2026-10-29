import { AppError } from "@verasjuris/types";

/**
 * Streaming / hosting de mídia educacional (vídeo, áudio).
 * Default: not_configured — sem URL de playback inventada.
 */

export type EducationMediaHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type EducationMediaKind = "video" | "audio" | "other";

export type EducationMediaUploadInput = {
  lessonContentId?: string;
  filename: string;
  mimeType: string;
  byteLength?: number;
  kind?: EducationMediaKind;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type EducationMediaAsset = {
  externalMediaId: string | null;
  providerKey: string;
  status: "ready" | "processing" | "failed" | "not_configured";
  kind: EducationMediaKind;
  playbackUrl: string | null;
  uploadUrl: string | null;
  durationSeconds?: number | null;
};

export type EducationMediaPlaybackInput = {
  externalMediaId: string;
  viewerUserId?: string;
  expiresInSeconds?: number;
  signal?: AbortSignal;
};

export type EducationMediaPlaybackResult = {
  externalMediaId: string | null;
  providerKey: string;
  status: "ready" | "expired" | "unavailable" | "not_configured";
  playbackUrl: string | null;
  expiresAt?: string | null;
};

export interface EducationMediaProvider {
  readonly id: string;
  createUpload(input: EducationMediaUploadInput): Promise<EducationMediaAsset>;
  getAsset(externalMediaId: string, signal?: AbortSignal): Promise<EducationMediaAsset>;
  createPlaybackUrl(input: EducationMediaPlaybackInput): Promise<EducationMediaPlaybackResult>;
  deleteAsset(externalMediaId: string, signal?: AbortSignal): Promise<void>;
  healthCheck(): Promise<EducationMediaHealth>;
}

const MESSAGE =
  "Nenhum provedor de mídia educacional está configurado. Anexe conteúdo via documento interno ou referência externa manual.";

function notConfiguredAsset(kind: EducationMediaKind = "other"): EducationMediaAsset {
  return {
    externalMediaId: null,
    providerKey: "not_configured",
    status: "not_configured",
    kind,
    playbackUrl: null,
    uploadUrl: null,
    durationSeconds: null,
  };
}

export class NotConfiguredEducationMediaProvider implements EducationMediaProvider {
  readonly id = "not_configured";

  createUpload(input: EducationMediaUploadInput): Promise<EducationMediaAsset> {
    return Promise.resolve(notConfiguredAsset(input.kind ?? "other"));
  }

  getAsset(_externalMediaId: string): Promise<EducationMediaAsset> {
    return Promise.resolve(notConfiguredAsset());
  }

  createPlaybackUrl(_input: EducationMediaPlaybackInput): Promise<EducationMediaPlaybackResult> {
    return Promise.resolve({
      externalMediaId: null,
      providerKey: "not_configured",
      status: "not_configured",
      playbackUrl: null,
      expiresAt: null,
    });
  }

  deleteAsset(_externalMediaId: string): Promise<void> {
    return Promise.reject(new AppError("EDUCATION_MEDIA_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<EducationMediaHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de mídia educacional não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
