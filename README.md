# SAP Browser Automation

SAP Browser Automation is a Chrome extension for AI-powered web task automation. It runs a multi-agent system locally in your browser and supports multiple LLM providers through OpenRouter and other configured backends.

## Features

- **Multi-agent workflow**: Planner, Navigator, and Validator agents collaborate on complex tasks
- **Computer use mode**: Anthropic-style computer use via OpenRouter for screenshot-driven browser control
- **Side panel UI**: Chat-based task input with live execution updates
- **Flexible LLM setup**: Configure models per agent in the options page
- **Local execution**: Automation runs in your browser with your own API keys

## Requirements

- Node.js `>=22.12.0` (see `.nvmrc`)
- pnpm `9.15.1`
- Chrome or Edge (recommended)

## Development

```bash
nvm use
pnpm install
pnpm dev
```

Build for production:

```bash
pnpm build
```

Load the unpacked extension from the `dist/` directory:

1. Open `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

## Useful commands

| Command | Description |
| --- | --- |
| `pnpm dev` | Dev build with hot reload |
| `pnpm build` | Production build |
| `pnpm type-check` | TypeScript checks |
| `pnpm lint` | ESLint |
| `pnpm -F chrome-extension test` | Unit tests |
| `pnpm zip` | Build and create a zip in `dist-zip/` |

## Project structure

- `chrome-extension/` — background service worker, agents, browser automation
- `pages/side-panel/` — main chat UI
- `pages/options/` — extension settings
- `packages/storage/` — persisted settings and chat storage
- `packages/i18n/` — localized UI strings

## Configuration

1. Open the extension options page
2. Add your LLM provider API keys
3. Choose models for Planner, Navigator, and Validator
4. Set automation mode to **Computer use** or **DOM actions** as needed

## License

Apache-2.0
