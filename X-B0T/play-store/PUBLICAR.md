# Como publicar o X-B0T na Play Store

O GitHub monta o app sozinho a cada alteração na pasta `X-B0T` (aba **Actions** → **Android (X-B0T)**). Cada execução gera dois arquivos:

| Arquivo | Para que serve |
| --- | --- |
| `X-B0T-apk-teste` | APK para instalar direto no celular e testar |
| `X-B0T-play-store-aab` | Pacote `.aab` para enviar à Play Store |

## 1. Testar no celular (APK)

1. No GitHub: **Actions** → **Android (X-B0T)** → abra a execução mais recente.
2. Em **Artifacts**, baixe `X-B0T-apk-teste` e extraia o `app-debug.apk`.
3. Passe o arquivo para o celular Android, abra e permita **instalar apps desconhecidos** quando ele pedir.

## 2. Configurar a chave de assinatura (uma vez só)

A Play Store só aceita `.aab` assinado com a sua chave de upload. A chave foi entregue à parte (pasta `chave-x-b0t`), **nunca** no repositório.

1. Guarde a pasta `chave-x-b0t` num lugar seguro (pendrive, nuvem particular). Sem ela não dá para enviar atualizações.
2. No GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Crie os 4 secrets do arquivo `SECRETS-DO-GITHUB.txt`:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD`.
3. Em **Actions** → **Android (X-B0T)** → **Run workflow**. O `X-B0T-play-store-aab` dessa execução já sai assinado.

## 3. Conta e app no Google Play Console

1. Crie a conta de desenvolvedor em https://play.google.com/console (taxa única de US$ 25 e verificação de identidade).
2. **Criar app**: nome `X-B0T`, idioma Português (Brasil), tipo **Jogo**, **Gratuito**.
3. Em **Configurar o app**, preencha:
   - **Política de privacidade**: link do arquivo `PRIVACIDADE.md` no GitHub (ex.: `https://github.com/NeyruP/TCG/blob/main/X-B0T/play-store/PRIVACIDADE.md`).
   - **Acesso ao app**: todo o conteúdo está disponível sem login.
   - **Anúncios**: não contém anúncios.
   - **Classificação do conteúdo**: responda o questionário (jogo de cartas, sem violência realista, sem compras).
   - **Público-alvo**: escolha as faixas de idade. Se incluir menores de 13 anos, o app segue a política de Famílias (o X-B0T já atende: sem anúncios e sem coleta de dados).
   - **Segurança dos dados**: o app **não coleta nem compartilha** dados.
4. **Ficha da loja principal** (textos abaixo e imagens desta pasta):
   - Ícone: `icone-512.png`
   - Gráfico de destaque: `destaque-1024x500.png`
   - Capturas de tela do telefone: pasta `capturas/`

## 4. Enviar o app

1. **Testes** → **Teste fechado** → criar versão → envie o `app-release.aab` (de dentro do `X-B0T-play-store-aab`). Na primeira vez, aceite a **Assinatura de apps do Google Play**.
2. Contas pessoais novas precisam de um teste fechado com **pelo menos 12 testadores por 14 dias seguidos** antes de liberar a **Produção**. Adicione os e-mails dos testadores (amigos, colegas da feira) e compartilhe o link de teste.
3. Depois dos 14 dias, peça acesso à **Produção** e publique.

Atualizações: a cada mudança, o GitHub gera um novo `.aab` com número de versão maior. É só enviar em uma nova versão.

> O identificador do app é `com.neyrup.xb0t` (em `capacitor.config.ts` e `android/app/build.gradle`). Ele não pode mudar depois do primeiro envio à Play Store.

## Textos da ficha da loja

**Nome do app:** X-B0T

**Descrição curta:**
TCG de duelo Magia vs Máquina: monte seu campo e derrote o líder inimigo!

**Descrição completa:**
X-B0T é um jogo de cartas colecionáveis (TCG) de duelo, feito para quem nunca jogou um TCG.

Escolha sua escola e enfrente a máquina:
• Escola Arcana — Rogen, feitiços, o Tomo da Sabedoria e a Grande Biblioteca.
• Oficina Especialista — Bobo, robôs, torretas, o Servidor e o Mecha.

Como funciona:
• Toque numa carta da mão para jogar, ou arraste para o campo.
• As cartas que podem atacar brilham: toque nela e depois no alvo.
• Defensores protegem o líder, cartas Counter salvam seus aliados e o dano fica marcado em cada carta.
• Efeitos visuais mostram cada golpe: números de dano, cartas se despedaçando e a tela piscando quando você é atingido.

A máquina começa mansa e fica mais esperta a cada partida. Tem tutorial passo a passo e funciona sem internet, sem anúncios e sem coletar dados.

Projeto criado para a feira de ciências.
