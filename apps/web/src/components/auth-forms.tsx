"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Button, FormField, Input } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFailure } from "../lib/types";

async function submit(path: string, body: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [CSRF_HEADER]: "1",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as ApiFailure & {
    status?: string;
    message?: string;
    emailDelivery?: string;
    verified?: boolean;
    reset?: boolean;
  };
  return { response, data };
}

function fieldError(data: ApiFailure, path: string): string | undefined {
  return data.error?.details?.find((detail) => detail.path === path)?.message;
}

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submit("/api/v1/auth/login", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(result.data.error?.message ?? "Não foi possível entrar. Nenhuma sessão foi aberta.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <FormField id="email" label="E-mail" error={fieldError(fields, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldError(fields, "email"))}
          aria-describedby={fieldError(fields, "email") ? "email-error" : undefined}
        />
      </FormField>
      <FormField id="password" label="Senha" error={fieldError(fields, "password")}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(fieldError(fields, "password"))}
          aria-describedby={fieldError(fields, "password") ? "password-error" : undefined}
        />
      </FormField>
      <p>
        <a href="/recuperar-conta">Esqueci a senha</a>
      </p>
      <Button type="submit" loading={pending} loadingLabel="Entrando">
        Entrar
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSuccess(null);
    const result = await submit("/api/v1/auth/register", {
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(
        result.data.error?.message ??
          "Não foi possível criar a conta. Nenhum cadastro foi confirmado.",
      );
      return;
    }
    setSuccess(
      result.data.message ??
        "Se existir uma conta elegível para este e-mail, enviaremos as próximas instruções.",
    );
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {success ? <p role="status">{success}</p> : null}
      <FormField id="displayName" label="Nome" error={fieldError(fields, "displayName")}>
        <Input
          id="displayName"
          name="displayName"
          autoComplete="name"
          required
          aria-invalid={Boolean(fieldError(fields, "displayName"))}
          aria-describedby={fieldError(fields, "displayName") ? "displayName-error" : undefined}
        />
      </FormField>
      <FormField id="email" label="E-mail" error={fieldError(fields, "email")}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(fieldError(fields, "email"))}
          aria-describedby={fieldError(fields, "email") ? "email-error" : undefined}
        />
      </FormField>
      <FormField
        id="password"
        label="Senha"
        hint="Use pelo menos 12 caracteres."
        error={fieldError(fields, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          aria-invalid={Boolean(fieldError(fields, "password"))}
          aria-describedby={
            fieldError(fields, "password") ? "password-hint password-error" : "password-hint"
          }
        />
      </FormField>
      <Button type="submit" loading={pending} loadingLabel="Criando a conta">
        Criar conta
      </Button>
      <p>
        Já tem conta? <a href="/entrar">Entrar</a> · <a href="/verificar-email">Verificar e-mail</a>
      </p>
    </form>
  );
}

export function RequestResetForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setMessage(null);
    const result = await submit("/api/v1/auth/password-reset/request", {
      email: String(formData.get("email") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setMessage(result.data.error?.message ?? "Não foi possível processar o pedido.");
      return;
    }
    setMessage(result.data.message ?? "Se existir uma conta elegível, enviaremos as instruções.");
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {message ? <p role="status">{message}</p> : null}
      <FormField id="email" label="E-mail" error={fieldError(fields, "email")}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" loading={pending} loadingLabel="Enviando pedido">
        Solicitar redefinição
      </Button>
    </form>
  );
}

export function ConfirmResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<ApiFailure>({});

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await submit("/api/v1/auth/password-reset/confirm", {
      token,
      password: String(formData.get("password") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setFields(result.data);
      setError(result.data.error?.message ?? "Não foi possível redefinir a senha.");
      return;
    }
    router.push("/entrar");
    router.refresh();
  }

  if (!token) {
    return (
      <p role="alert" className="vj-field-error">
        Este link de redefinição está incompleto ou já expirou.
      </p>
    );
  }

  return (
    <form className="vj-stack" action={onSubmit} noValidate>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <FormField
        id="password"
        label="Nova senha"
        hint="Use pelo menos 12 caracteres."
        error={fieldError(fields, "password")}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </FormField>
      <Button type="submit" loading={pending} loadingLabel="Salvando">
        Redefinir senha
      </Button>
    </form>
  );
}

export function VerifyEmailForm({ initialToken = "" }: { initialToken?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(token: string) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await submit("/api/v1/auth/email-verification/confirm", { token });
    setPending(false);
    if (!result.response.ok) {
      setError(result.data.error?.message ?? "Não foi possível verificar o e-mail.");
      return;
    }
    setMessage("E-mail verificado. Você já pode entrar.");
  }

  async function request(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await submit("/api/v1/auth/email-verification/request", {
      email: String(formData.get("email") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setError(result.data.error?.message ?? "Não foi possível processar o pedido.");
      return;
    }
    setMessage(result.data.message ?? "Se existir uma conta elegível, enviaremos as instruções.");
  }

  if (initialToken) {
    return (
      <div className="vj-stack">
        {error ? (
          <p role="alert" className="vj-field-error">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status">{message}</p>
        ) : (
          <Button
            type="button"
            loading={pending}
            loadingLabel="Verificando"
            onClick={() => void confirm(initialToken)}
          >
            Confirmar e-mail
          </Button>
        )}
        {message ? (
          <p>
            <a href="/entrar">Entrar</a>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="vj-stack" action={request} noValidate>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <FormField id="email" label="E-mail">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </FormField>
      <Button type="submit" loading={pending} loadingLabel="Solicitando">
        Reenviar verificação
      </Button>
    </form>
  );
}
