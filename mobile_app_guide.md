# Guia de Geração do Aplicativo Android (.apk)

Este guia explica como gerar o arquivo `.apk` para instalar o **LogiWMS Pro** no seu celular Android.

## Requisitos Prévios

1.  **Android Studio Instalado**: Você precisa ter o Android Studio instalado no seu computador.
    *   [Download Android Studio](https://developer.android.com/studio)
2.  **IP da Rede Local**: Seu celular precisa estar na mesma rede Wi-Fi do seu computador.
    *   Descubra seu IP no Windows: Abra o terminal e digite `ipconfig`. Procure por **Endereço IPv4** (Ex: `192.168.0.15`).

## Passo 1: Configurar Endereço da API

Como o celular é um dispositivo externo, ele não entende `localhost`. Você precisa apontar o app para o IP do seu computador ou do servidor EC2.

1.  Abra o arquivo `src/supabase.ts`.
2.  Altere a linha do `API_URL`:

```typescript
// Se estiver testando localmente na sua rede Wi-Fi:
const API_URL = 'http://SEU_IP_AQUI:3001/api'; 
// Exemplo: const API_URL = 'http://192.168.0.15:3001/api';

// Se já estiver no servidor AWS EC2:
// const API_URL = 'http://SEU_IP_PUBLICO_EC2/api';
```

3.  Salve o arquivo.
4.  Reconstrua o projeto no terminal:
    ```bash
    npm run build
    npx cap sync
    ```

## Passo 2: Abrir no Android Studio

No terminal do projeto, execute:

```bash
npx cap open android
```

**Se o Android Studio abrir na tela de "Welcome" (Boas-vindas):**
1.  Clique em **Open** (ou "Open an existing project").
2.  Navegue até a pasta do projeto: `Downloads\logiwms-pro...\`
3.  **MUITO IMPORTANTE**: Entre na pasta e selecione a subpasta chamada **android** (ícone de um robozinho ou pasta com um "a").
    *   *Não selecione a pasta principal do projeto.*
4.  Clique em **OK**.

Isso carregará o projeto LogiWMS.

## Passo 3: Gerar o APK

1.  No Android Studio, aguarde o Gradle sincronizar (barra de progresso no canto inferior).
2.  Vá no menu superior: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3.  Aguarde a compilação.
4.  Quando terminar, aparecerá uma notificação no canto inferior direito. Clique em **locate**.
    *   O arquivo será algo como `app-debug.apk`.
5.  Envie esse arquivo para seu celular (via WhatsApp, USB ou Google Drive) e instale.

## Passo 4: Rodar o Servidor (Backend)

Para o App funcionar, seu computador (ou servidor) deve estar rodando o Backend e o Banco de Dados.

1.  No seu computador, certifique-se de que o Docker ou o Backend Node.js está rodando.
    *   Com Docker: `docker compose up`
    *   Manual: `cd api-backend && npm run dev` (porta 3001)

## Solução de Problemas

*   **Tela Branca no Celular**: Geralmente significa que o celular não consegue acessar a API. Verifique se o IP está correto e se o Firewall do Windows não está bloqueando a porta 3001.
*   **Erro de Conexão**: Certifique-se de que celular e PC estão no mesmo Wi-Fi.

---
**Nota**: Para publicar na Play Store, você precisaria de uma conta de desenvolvedor Google e gerar um "Signed Bundle/APK", mas para uso interno/teste, o passo a passo acima é suficiente.
