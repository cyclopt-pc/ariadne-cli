# Ariadne CLI

Standalone CLI for Ariadne authentication and OpenCode agent/skill provisioning. **End users do not need Node.js or Bun.**

## Installation

Download the executable for your OS from GitHub Releases, or run the installer **after inspecting it**:

```sh
curl -fsSLO https://raw.githubusercontent.com/cyclopt-pc/ariadne-cli/main/scripts/install.sh
sh ./install.sh
```

For Windows use `scripts/install.ps1` (download and inspect it first). Binary releases are SHA256 verified by these scripts. macOS downloads may need user approval until binaries are signed/notarized.

Install directory defaults to `~/.local/bin` (ensure it is in your PATH).

## Commands

```sh
ariadne --version
ariadne login
ariadne whoami
ariadne init
ariadne sync
ariadne doctor
ariadne logout
```

For the current local backend:
```sh
export ARIADNE_API_BASE_URL=http://localhost:8080
ariadne login
```

Login requires `http://127.0.0.1:8765/callback` registered in the Auth0 Native Application. Back-end endpoints `/api/oauth/cli/exchange`, `/api/agentic/organizations`, `/api/agentic/provisioning` are required.

**Do not pass `--install-matrixx` on your existing manually built Matrixx installation.** `init` without the flag only provisions managed OpenCode files.

## Release process

- Open PR against `main`; CI runs syntax, tests, and binary smoke build.
- Merge to `main`: release workflow re-runs tests, compiles 5 standalone targets, checks SHA256, and creates the next patch GitHub Release (`v0.1.0`, `v0.1.1`, ...).
- Every push to `main` releases a patch, including documentation-only changes. This is intentional; switch to semantic-release later if desired.
- Workflow uses `GITHUB_TOKEN`; repository Settings → Actions → General must allow **Read and write permissions**, or grant permission via workflow/repository policy.
- **No npm publication**; the package.json is used for developer tooling only. The GitHub repo must exist before releases work.

## Local development

```sh
npm run check
npm test
# Bun required only on build machine:
bash scripts/build.sh
```

`ARIADNE_CLI_VERSION` is embedded using Bun `--define`; the tagged version is set during release.

## Limitations

- CLI uses a fixed localhost callback port (8765).
- Session JWT is stored in an owner-restricted file, not OS Keychain yet.
- Model selection, MCP distribution, and governance enforcement are not implemented.
- No real Auth0/MongoDB integration tests have been run with production services.
- Standalone binaries have not been signed/notarized; macOS may display security warnings.
- Matrixx installation remains optional and requires existing Bun/OpenCode if requested.
