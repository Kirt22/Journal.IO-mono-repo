# App Store Connect MCP (read-only)

Exposes the Journal.IO App Store listing to Claude Code and Codex: app info,
versions, localized metadata, screenshots and customer reviews.

**Every tool is a GET.** Nothing in this server can modify a live App Store
page. Adding write access (screenshot upload, metadata editing) is a deliberate
future change, not an accident waiting to happen.

## Setup

### 1. Create an API key

App Store Connect → **Users and Access → Integrations → App Store Connect API**.
Create a key with the **App Manager** role (Developer works if you only ever
read). You get three things:

- **Issuer ID** — shown once at the top of the page, shared across all keys
- **Key ID** — the 10-character string next to the key
- **`AuthKey_<KEYID>.p8`** — downloadable exactly once, so keep it

### 2. Store the credentials outside the repo

```bash
mkdir -p ~/.appstoreconnect
mv ~/Downloads/AuthKey_XXXXXXXXXX.p8 ~/.appstoreconnect/
chmod 600 ~/.appstoreconnect/AuthKey_XXXXXXXXXX.p8

cat > ~/.appstoreconnect/config.json <<'JSON'
{
  "issuerId": "your-issuer-id-here",
  "keyId": "XXXXXXXXXX",
  "privateKeyPath": "~/.appstoreconnect/AuthKey_XXXXXXXXXX.p8"
}
JSON
chmod 600 ~/.appstoreconnect/config.json
```

The `.p8` is a private key. It never belongs in the repo, in `.mcp.json`, in a
commit, or in a chat message. `*.p8` is gitignored as a backstop.

Environment variables (`ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY_PATH`)
take precedence over the config file if you prefer them. `ASC_CONFIG_PATH`
overrides the config file location.

### 3. Build

```bash
cd tools/asc-mcp && npm install && npm run build
```

### 4. Register

**Claude Code** — already wired up in `.mcp.json` at the repo root. Restart
Claude Code and confirm with `claude mcp list`.

**Codex** — add to `~/.codex/config.toml`:

```toml
[mcp_servers.app_store_connect]
command = "node"
args = ["/Users/kirtansolanki/Desktop/VS_Code_files/Journal.IO/tools/asc-mcp/dist/index.js"]
```

## Tools

| Tool | Purpose |
|------|---------|
| `asc_list_apps` | Every app on the account. Start here for an `appId`. |
| `asc_get_app` | One app by bundle ID (defaults to `app.journalio`). |
| `asc_list_versions` | App Store versions, with state and release type. |
| `asc_get_app_info_localizations` | **Name and subtitle** — the ASO keyword fields. |
| `asc_get_version_localizations` | Description, keywords, promo text, what's new. |
| `asc_list_screenshots` | Screenshot sets with display types and download URLs. |
| `asc_download_screenshots` | Writes the live screenshots to a local directory. |
| `asc_list_customer_reviews` | Real review text, for genuine testimonial copy. |

Typical chain: `asc_get_app` → `asc_list_versions` →
`asc_get_version_localizations` → `asc_list_screenshots`.

## What this cannot do

Worth being blunt about, since it shapes what you can ask of it:

- **No competitor data.** It reads your account only. Nothing about Rosebud or
  any other app.
- **No per-screenshot conversion attribution.** That requires Product Page
  Optimization, which Apple does not expose through the public API. Analytics
  reports exist but are aggregate and delayed.

Its real value is keeping caption copy consistent with the live subtitle and
keywords, pulling genuine review text, and inspecting the current set without
clicking through the web UI.

## Implementation notes

Auth is an ES256 JWT signed with the `.p8`, minted for 15 minutes (Apple caps it
at 20) and cached until just before expiry. `node:crypto` signs ES256 directly
with `dsaEncoding: 'ieee-p1363'`, which produces the raw R‖S signature JWS wants
rather than Node's default DER. The only runtime dependency is the MCP SDK.

Collection endpoints follow `links.next`, so list tools return the full set
rather than the first page.

stdout is the MCP transport — all diagnostics go to stderr.
