import { AppError } from "@verasjuris/types";

export type ObjectStorageProvider = {
  status: "NOT_CONFIGURED";
  upload(): Promise<never>;
};

export const objectStorage: ObjectStorageProvider = {
  status: "NOT_CONFIGURED",
  async upload() {
    throw new AppError(
      "NOT_CONFIGURED",
      "O upload real de documentos ainda não está configurado nesta versão.",
    );
  },
};
