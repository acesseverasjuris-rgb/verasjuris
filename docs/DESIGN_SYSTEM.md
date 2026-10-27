# Design system

Referência: Manual da Marca e Comunicação VerasJuris, versão 1.0, 24 de setembro de 2026.

## Tokens

As cores oficiais estão em `packages/ui/src/styles.css`:

- `--vj-navy` `#06295B` para estrutura
- `--vj-blue` `#0B56F0` para ação e foco
- `--vj-blue-light` `#EEF4FF` para contexto
- `--vj-ink` `#101828` e `--vj-gray` `#475467` para texto
- `--vj-border` `#D9D9D9` para divisão
- `--vj-success` `#067647`, `--vj-warning` `#B54708`, `--vj-error` `#B42318` apenas como estado, sempre com texto

Branco sobre azul elétrico mede 5,83:1. Branco sobre azul-marinho mede 14,23:1. Texto principal e secundário sobre branco ficam acima de 4,5:1. O teste `packages/ui/src/contrast.test.ts` lê os tokens e confere esses pares.

Há preparação de variáveis para um tema escuro, mas o tema escuro não foi implementado. Quando existir, não será uma inversão automática e terá sua própria versão de logotipo.

## Tipografia

Source Sans 3: 40 px no destaque, 24 px no título, 16 px no corpo, 12 px no metadado. IBM Plex Mono em 13 px para identificadores e códigos de auditoria. Aptos ficou de fora por licença, conforme `docs/DECISIONS.md`.

## Componentes desta fase

Botão, botão com ícone, campo, rótulo, seletor, alerta, selo, cartão, divisor, esqueleto, vazio, erro, carregamento, cabeçalho de página, trilha, avatar, menu, diálogo e o shell. Textarea existe no pacote porque o campo reutiliza a mesma borda e o foco; ainda não há formulário longo que a use.

Raio máximo de 4 px. Sombra só no diálogo. Estado não depende só da cor: alerta e selo têm texto.

## Marca

A grafia é VerasJuris. O slogan da página inicial é o slogan aprovado, acompanhado do que esta versão realmente faz e do que não faz. O rodapé identifica a Café Platine e a independência da plataforma.

A assinatura em duas cores e a versão negativa não são publicadas sem o arquivo mestre. O diretório `apps/web/public/brand` espera esses SVG.

## Linguagem

A interface fala “você”. Mensagens de falha dizem o que não aconteceu e o que foi preservado. O painel não afirma protocolo, prazo ou decisão.

## Acessibilidade

Objetivo WCAG 2.2 AA: contraste medido, foco visível, rótulos, mensagens junto ao campo, navegação por teclado no diálogo e no menu, HTML de tabela e `lang="pt-BR"`. Em telas estreitas a barra lateral vira menu com os mesmos rótulos; a ação principal do formulário continua visível.
