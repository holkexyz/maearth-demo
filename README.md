# Ma Earth Demo

AT Protocol OAuth demo app built with Next.js. Authenticates users via a [magic-pds](https://github.com/holkexyz/magic-pds) instance using passwordless email OTP, and provisions embedded Ethereum wallets via [magic-wallet](https://github.com/holkexyz/magic-wallet).

**Live at:** [maearth-demo.vercel.app](https://maearth-demo.vercel.app)

## Features

- Passwordless email login via AT Protocol OAuth (PAR + PKCE + DPoP)
- Handle-based login for any AT Protocol PDS (Bluesky, self-hosted, etc.)
- Automatic Ethereum wallet provisioning on signup (EOA + ERC-4337 smart account)
- Gasless test transactions on Sepolia testnet

## How it works

### Authentication

1. User enters email on the login page
2. App sends a Pushed Authorization Request (PAR) to the PDS with DPoP + PKCE
3. PDS redirects to the auth service, which emails a 6-digit OTP code
4. User enters the code, PDS issues an OAuth authorization code
5. App exchanges the code for tokens and resolves the user's handle via PLC directory

### Wallet

After successful OAuth login, the app calls the wallet service to provision an embedded Ethereum wallet. The welcome page displays:

- User's handle and DID
- EOA address and smart account address
- A form to send gasless ETH transactions on Sepolia testnet

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your values
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PUBLIC_URL` | `http://localhost:3000` | Base URL of this app |
| `PDS_URL` | `https://pds.certs.network` | AT Protocol PDS base URL |
| `AUTH_ENDPOINT` | `https://auth.pds.certs.network/oauth/authorize` | Authorization endpoint |
| `PLC_DIRECTORY_URL` | `https://plc.directory` | PLC directory for DID-to-handle resolution |
| `WALLET_SERVICE_URL` | | Wallet service URL (e.g., `https://wallet.certs.network`) |
| `WALLET_API_KEY` | | Shared secret for wallet service auth |

## Deployment

When deploying (e.g., to Vercel), `public/client-metadata.json` must be updated to match the deployed URL — the `client_id`, `client_uri`, `logo_uri`, `redirect_uris`, and `email_template_uri` fields all reference the app's public URL. This file is served statically and cannot use environment variables.

## Related

- [magic-pds](https://github.com/holkexyz/magic-pds) — Passwordless AT Protocol PDS
- [magic-wallet](https://github.com/holkexyz/magic-wallet) — Embedded Ethereum wallet service

## License

MIT
