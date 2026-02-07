# Guia de GeraÃ§Ã£o do Aplicativo Android (.apk)

Este guia explica como gerar o arquivo `.apk` para instalar o **LogiWMS Pro** no seu celular Android.

## Requisitos PrÃ©vios

1.  **Android Studio Instalado**: VocÃª precisa ter o Android Studio instalado no seu computador.
    *   [Download Android Studio](https://developer.android.com/studio)
2.  **IP da Rede Local**: Seu celular precisa estar na mesma rede Wi-Fi do seu computador.
    *   Descubra seu IP no Windows: Abra o terminal e digite `ipconfig`. Procure por **EndereÃ§o IPv4** (Ex: `192.168.0.15`).

## Passo 1: Configurar EndereÃ§o da API

Como o celular Ã© um dispositivo externo, ele nÃ£o entende `localhost`. VocÃª precisa apontar o app para o IP do seu computador ou do servidor EC2.

1.  Crie/edite o arquivo `.env.local` na raiz do projeto.
2.  Defina a variavel `VITE_API_URL`:

```env
# Se estiver testando localmente na sua rede Wi-Fi:
VITE_API_URL=http://SEU_IP_AQUI:3001
# Exemplo: VITE_API_URL=http://192.168.0.15:3001

# Se ja estiver no servidor AWS EC2:
# VITE_API_URL=http://SEU_IP_PUBLICO_EC2
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
2.  Navegue atÃ© a pasta do projeto: `Downloads\logiwms-pro...\`
3.  **MUITO IMPORTANTE**: Entre na pasta e selecione a subpasta chamada **android** (Ã­cone de um robozinho ou pasta com um "a").
    *   *NÃ£o selecione a pasta principal do projeto.*
4.  Clique em **OK**.

Isso carregarÃ¡ o projeto LogiWMS.

## Passo 3: Gerar o APK

1.  No Android Studio, aguarde o Gradle sincronizar (barra de progresso no canto inferior).
2.  VÃ¡ no menu superior: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3.  Aguarde a compilaÃ§Ã£o.
4.  Quando terminar, aparecerÃ¡ uma notificaÃ§Ã£o no canto inferior direito. Clique em **locate**.
    *   O arquivo serÃ¡ algo como `app-debug.apk`.
5.  Envie esse arquivo para seu celular (via WhatsApp, USB ou Google Drive) e instale.

## Passo 4: Rodar o Servidor (Backend)

Para o App funcionar, seu computador (ou servidor) deve estar rodando o Backend e o Banco de Dados.

1.  No seu computador, certifique-se de que o Docker ou o Backend Node.js estÃ¡ rodando.
    *   Com Docker: `docker compose up`
    *   Manual: `cd api-backend && npm run dev` (porta 3001)

## SoluÃ§Ã£o de Problemas

*   **Tela Branca no Celular**: Geralmente significa que o celular nÃ£o consegue acessar a API. Verifique se o IP estÃ¡ correto e se o Firewall do Windows nÃ£o estÃ¡ bloqueando a porta 3001.
*   **Erro de ConexÃ£o**: Certifique-se de que celular e PC estÃ£o no mesmo Wi-Fi.

---
**Nota**: Para publicar na Play Store, vocÃª precisaria de uma conta de desenvolvedor Google e gerar um "Signed Bundle/APK", mas para uso interno/teste, o passo a passo acima Ã© suficiente.


