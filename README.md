# Meta Lead Ads → Real-time React Native PoC

Receive a Meta Lead Ads webhook, fetch the lead's actual form fields through the Graph API, and show the lead in an Expo React Native app over Socket.IO.

```text
Meta Lead Ads Testing Tool
    └─ Page leadgen webhook → ngrok → Express backend
                                     ├─ Graph API lead details
                                     └─ Socket.IO → Expo app
```

The app renders standard contact fields and additional form fields returned by Meta. The test-lead form used to verify this flow returned `email`, `full_name`, `want_to__move_or_stay_`, and `inbox_url`; field names depend on the selected form.

## Requirements

- Node.js 18 or later and npm
- A Meta developer app and a Facebook Page/form you administer
- ngrok for delivering Meta webhooks to a local backend
- Expo Go on a physical device, or an Android/iOS emulator

## 1. Configure and start the backend

In PowerShell:

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env`:

```dotenv
PORT=3000
VERIFY_TOKEN=replace-me
APP_SECRET=your-meta-app-secret
PAGE_ACCESS_TOKEN=replace-me
GRAPH_VERSION=v26.0
MOCK_GRAPH=false
CLIENT_TOKEN=
ENABLE_SIMULATOR=true
MAX_LEADS=200
```

Use a Page access token with the `leads_retrieval` permission. Keep `.env` private; never commit or share its values. A Page token can expire, so check/regenerate it if Graph API reports an expired or invalid token. `APP_SECRET` enables webhook signature verification; set it to the App Secret for the Meta app.

Start the backend and leave this terminal open:

```powershell
npm start
```

It listens on `http://localhost:3000`. Check `http://localhost:3000/health` for backend status. The in-memory lead list is cleared whenever the backend restarts.

## 2. Expose the webhook with ngrok

In a second terminal:

```powershell
ngrok config add-authtoken YOUR_NGROK_TOKEN
ngrok http 3000
```

Keep ngrok running. Copy its public HTTPS URL, for example `https://example.ngrok-free.app`. Meta's callback URL is that URL plus `/webhook`, for example `https://example.ngrok-free.app/webhook`. Free ngrok URLs can change; if yours changes, update the Meta callback and the mobile app's `EXPO_PUBLIC_SERVER_URL`.

## 3. Configure and start the mobile app

In another terminal:

```powershell
cd mobile
npm install
Copy-Item .env.example .env
```

Set `EXPO_PUBLIC_SERVER_URL` in `mobile/.env` to the ngrok HTTPS URL (without `/webhook`). If `CLIENT_TOKEN` is set in `backend/.env`, set the same value as `EXPO_PUBLIC_CLIENT_TOKEN`; otherwise leave it empty.

Start Expo and leave the terminal open:

```powershell
npx expo start -c
```

Scan the QR code with Expo Go. The app should show **Live** when its Socket.IO connection succeeds. If you change `mobile/.env`, restart Expo with `npx expo start -c` and reload the app so the new public URL is bundled. A physical phone should use the HTTPS ngrok URL; emulator-only fallbacks are defined in `mobile/src/config.js`.

## 4. Configure Meta webhooks

1. In the Meta developer dashboard, add the **Webhooks** product to your app.
2. Choose the **Page** object and configure:
   - **Callback URL:** `https://YOUR-NGROK-HOST/webhook`
   - **Verify token:** exactly the `VERIFY_TOKEN` in `backend/.env`
3. Click **Verify and Save**, then subscribe to the Page's `leadgen` field.
4. Subscribe the app to the Page's lead events. With an appropriately permissioned Page token, the Graph API request is:
   ```text
   POST /{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen
   ```
   Commonly needed permissions include `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, and `leads_retrieval`. Meta account/app roles and access level also apply.

## 5. Create and verify a test lead

1. Open the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing), then select the Page and form.
2. The tool allows one test lead per form. If one already exists, click **Delete lead** first.
3. Click **Create lead**, then **Track status**. The delivery status should show **Success**.
4. The backend fetches lead details from Graph API and emits the lead to connected mobile clients. The lead card shows email and phone when present, plus any other form fields.

Meta's testing tool may return placeholder/dummy values (for example, `<test lead: dummy data for full_name>`); this is expected for a test lead. Form fields vary by form.

The current lead list is in memory only. If the backend restarts after Meta sends the event, delete and create the test lead again to repopulate the app.

## Local checks

```powershell
# Backend health and current in-memory leads
Invoke-RestMethod http://localhost:3000/health
Invoke-RestMethod http://localhost:3000/api/leads

# Optional local simulator (uses mock data when configured without a Page token)
Invoke-RestMethod -Method Post http://localhost:3000/api/simulate
```

The simulator is enabled by default for development; disable it with `ENABLE_SIMULATOR=false` when it is not wanted.

## Troubleshooting

| Symptom | Check |
|---|---|
| Meta webhook verification fails | Backend and ngrok are running; callback ends in `/webhook`; `VERIFY_TOKEN` matches exactly. |
| Meta test delivery is rejected | Check the Meta Track status details, public HTTPS URL, Page `leadgen` subscription, and backend logs. |
| No lead appears after delivery | Confirm delivery says **Success**. A restart clears the in-memory leads; delete and create the test lead again. |
| Graph lookup fails or lead has IDs only | Check that `PAGE_ACCESS_TOKEN` is a valid Page token with `leads_retrieval`, and that `GRAPH_VERSION` is supported. |
| Token validation reports expired | Regenerate the Page token, update `backend/.env`, and restart the backend. |
| App shows “Cannot reach server” | Check `http://localhost:3000/health` and the ngrok public URL, set the mobile `.env` URL to the HTTPS tunnel host, then restart Expo with `-c` and reload the app. |
| App stays disconnected with `CLIENT_TOKEN` enabled | Ensure `EXPO_PUBLIC_CLIENT_TOKEN` exactly matches `CLIENT_TOKEN`; restart Expo after changing `.env`. |
| Signature warning appears | Set the matching `APP_SECRET` in `backend/.env` and restart. Without it, webhook signatures are not verified. |

## Implementation notes

- The webhook acknowledges Meta promptly and processes lead details asynchronously.
- Duplicate webhook deliveries are deduplicated by `leadgen_id` in memory.
- Graph API errors are logged; the lead is still delivered with available webhook IDs and `source: webhook_only`.
- Reconnected clients receive a snapshot of the in-memory leads.
- This is a single-tenant demo: connected clients share the lead stream. There is no durable database or production-grade tenant isolation.

## Production hardening

Before production use, add durable storage, tenant/page-specific authorization and socket rooms, token rotation/secret management, rate limits, restricted CORS, webhook signature verification, and retry/backoff for Graph API failures. Disable the simulator and avoid exposing test or lead data through unauthenticated endpoints.
