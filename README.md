# arduino-compile-service

Microserviciu HTTP care primește un sketch Arduino + FQBN și returnează binarul compilat (`.bin` / `.hex` / `.uf2`) ca base64. Folosit de Zamolxis AI pentru a flash-ui plăci reale din browser.

## Endpoints
- `GET /health` — listă cu cores instalate.
- `POST /compile` — body: `{ sketch, fqbn, libraries? }`, header `x-compile-token: <TOKEN>`.

## Deploy pe Railway
1. `npm i -g @railway/cli` (sau `brew install railway`)
2. `railway login`
3. În folderul ăsta: `railway init` → alege „Empty Project", dă-i un nume (ex. `zamolxis-arduino`)
4. `railway up` (urcă Dockerfile-ul, durează 5-8 minute prima dată)
5. `railway variables --set ARDUINO_COMPILE_TOKEN=<un-token-secret-lung>`
6. `railway domain` → primești un URL public `https://xxx.up.railway.app`
7. Dă-i URL-ul + tokenul agentului Lovable, salvăm ca secrete `ARDUINO_COMPILE_URL` și `ARDUINO_COMPILE_TOKEN`.

## Test rapid
```bash
curl https://<url>.up.railway.app/health
```
