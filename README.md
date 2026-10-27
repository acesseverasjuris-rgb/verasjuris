# VerasJuris

Fundação da plataforma jurídica digital VerasJuris. Esta versão consolida identidade, autenticação, memberships, organizações, verificação de e-mail, recuperação de conta e convites. Ela não gerencia processos, clientes, prazos, documentos, peticionamento, pagamentos ou marketplace.

A Café Platine desenvolve o VerasJuris. A plataforma é independente de escritórios, autoridades e órgãos públicos.

## Requisitos

- Node.js 24
- pnpm 10
- PostgreSQL 16 para executar a API, o worker e as migrations

Os testes automatizados usam PostgreSQL embutido (PGlite) e não exigem o servidor.

## Começar do zero

```bash
corepack enable
corepack prepare pnpm@10.18.3 --activate
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: http://127.0.0.1:3000
- API: http://127.0.0.1:4000/health
- Worker: http://127.0.0.1:4001/health

`pnpm db:seed` grava os papéis e as permissões de referência. Sem essa etapa, a API recusa iniciar. Um usuário local só é criado se `SEED_USER_NAME`, `SEED_USER_EMAIL` e `SEED_USER_PASSWORD` estiverem preenchidos no `.env`. A senha precisa ter pelo menos 12 caracteres e não fica no repositório.

Se o Docker não estiver disponível, suba um PostgreSQL 16 local com o mesmo usuário, senha e banco descritos em `.env.example`.

## Verificação

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## O que esta versão faz

- Cadastro com anti-enumeração, verificação de e-mail e entrada com senha (sessão HttpOnly).
- Recuperação de senha, troca autenticada e gestão básica de sessões.
- Organização, membership multi-tenant, convites e troca de organização ativa (só contexto).
- Papéis de proprietário, administrador e membro, com permissão `member.invite`.
- Provider de e-mail abstrato (`not_configured` ou `memory` em testes/dev).
- Auditoria persistida das ações desta versão, com bloqueio de alteração no banco.
- Healthcheck da API e do worker.

## O que esta versão não faz

Não há filas, provedor de e-mail real, MFA, passkeys, OAuth, provedor de IA, armazenamento de arquivos, pagamentos, peticionamento, biometria nem dados jurídicos de exemplo. O worker sobe e informa que a fila está `not_configured`. O gateway de IA recusa qualquer chamada.

A assinatura gráfica oficial ainda não está no repositório. Leia `apps/web/public/brand/README.md`.

## Documentação

- [Arquitetura](docs/ARCHITECTURE.md)
- [Identidade](docs/IDENTITY.md)
- [Autorização](docs/AUTHORIZATION.md)
- [Segurança](docs/SECURITY.md)
- [Domínios](docs/DOMAINS.md)
- [Roteiro](docs/ROADMAP.md)
- [Decisões](docs/DECISIONS.md)
- [Design system](docs/DESIGN_SYSTEM.md)
