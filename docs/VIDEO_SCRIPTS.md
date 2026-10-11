# Video Scripts

## A. 5-minute demo video (screen recording + phone)

**Before recording:** backend running, ngrok running, Meta webhook verified, app open on the phone/emulator (empty list, pill = "Live"). Arrange the screen: left = Lead Ads Testing Tool, right = phone mirror (scrcpy / Xcode simulator) plus a terminal tailing backend logs.

| Time | Show | Say |
|---|---|---|
| 0:00–0:30 | Title / README diagram | "This PoC shows a Meta test lead appearing live in a React Native screen with zero manual action. Flow: Meta → webhook → Express → Socket.IO → app." |
| 0:30–1:15 | Terminal (backend + ngrok), Meta Webhooks page | "Backend is running locally, exposed with ngrok. In Meta's dashboard the Page `leadgen` webhook points to this URL and was verified through the GET handshake, as you can see in this log line." |
| 1:15–2:00 | Phone | "The app is already open. Note the green Live pill. The socket was opened on mount. I'm not going to touch this device from here on." |
| 2:00–3:30 | Lead Ads Testing Tool → **Create lead** | "I choose my Page and form, and create a test lead." *(Wait, point at logs.)* "Backend logged the POST, then the Graph fetch, then pushed to 1 client." *(Point at phone.)* "The lead appeared with a NEW highlight. No refresh, no tap." |
| 3:30–4:15 | Create 2 more leads quickly | "Multiple leads stream in order. Duplicates from Meta retries are ignored by `leadgen_id`." |
| 4:15–4:45 | Toggle airplane mode off/on (or restart backend) | "On reconnect the server sends a snapshot, so leads missed while offline are restored." |
| 4:45–5:00 | README assumptions | "Assumptions and hardening ideas are in the README. Thanks for watching." |

**Backup if Meta delivery is slow:** run `curl -X POST <ngrok-url>/api/simulate` to show the same pipeline.

## B. Architecture / code walkthrough (~8–10 min)

1. **Diagram (1 min)** – Meta → ngrok → `/webhook` → store → Socket.IO → RN hook → FlatList.
2. **`server.js` – verification (1 min)** – `GET /webhook`: `hub.mode`, `hub.verify_token`, return `hub.challenge`.
3. **`server.js` – receive (2 min)**
   - `express.json({ verify })` keeps `rawBody`; HMAC SHA-256 of raw body vs `X-Hub-Signature-256`, using `timingSafeEqual`.
   - Respond 200 first, then process (Meta timeout/retry behaviour).
   - Payload contains IDs only → `fetchLeadDetails` calls `GET /{leadgen_id}`; falls back to mock or webhook-only.
   - `seen` Set dedupes retries.
4. **`server.js` – real-time (1 min)** – `io.emit('lead:new')`; `leads:snapshot` on connect; optional handshake token.
5. **`useLeads.js` (2 min)** – single effect, socket created on mount, cleaned on unmount; functional `setLeads` with dedupe; status states; reconnection options.
6. **`LeadCard.js` + `App.js` (1 min)** – `fresh` flag drives the highlight animation; `FlatList` with `keyExtractor`.
7. **Trade-offs (1 min)** – in-memory store, single instance, no per-tenant rooms, no push for backgrounded apps; how I'd scale (Redis adapter, DB, queue).
