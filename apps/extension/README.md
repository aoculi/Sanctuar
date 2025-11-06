# LockMark - Secure Bookmarks Vault

LockMark is a secure browser extension that provides an encrypted bookmark management system. It features end-to-end encryption, keeping your bookmarks safe with client-side encryption and secure storage.

## Getting Started

### Installation

First, install the project dependencies:

```bash
pnpm install
```

### Development

Run the extension in development mode:

```bash
# For Chrome/Chromium browsers
pnpm run dev

# For Firefox
pnpm run dev:firefox
```

### Building

Build the extension for production:

```bash
# Build for Chrome/Chromium
pnpm run build:prod

# Build for Firefox
pnpm run build:firefox:prod
```

### Creating a ZIP Package

To create a distributable ZIP file of the extension:

```bash
# Create ZIP for Chrome/Chromium
pnpm run zip

# Create ZIP for Firefox
pnpm run zip:firefox

# Create production ZIP for Firefox
pnpm run zip:firefox:prod
```

The ZIP file will be created in the output directory and can be loaded directly into browsers for testing or distribution.

## Installing on Firefox (Without Extension Store Account)

To use the extension on Firefox without submitting to the Firefox Add-on Store, you need to disable signature requirements:

1. **Open Firefox Configuration:**

   - Type `about:config` in the Firefox address bar
   - Accept the warning message if prompted

2. **Disable Signature Requirement:**

   - Search for `xpinstall.signatures.required`
   - Double-click to set it to `false`

3. **Load the Extension:**
   - Open `about:addons` in Firefox
   - Click the gear icon ⚙️ (usually in the top right)
   - Select "Install Add-on From File..."
   - Choose the ZIP file you created (or the unpacked extension directory)

The extension should now be loaded and ready to use.

## API Configuration

The extension connects to a local API server that you need to configure.
By default, the API app is typically reachable at `http://127.0.0.1:3500`, but you should configure the proper API URL for your specific setup in the extension settings.

1. **Open the extension settings** after installing the extension
2. **Set your API URL** - Enter the URL where your API server is running
3. **Save the settings**

Make sure your API server is running and accessible at the configured URL before using the extension.

## Available Commands

- `pnpm run dev` - Start development server for Chrome
- `pnpm run dev:firefox` - Start development server for Firefox
- `pnpm run build` - Build extension for Chrome
- `pnpm run build:firefox` - Build extension for Firefox
- `pnpm run build:prod` - Build production version for Chrome
- `pnpm run build:firefox:prod` - Build production version for Firefox
- `pnpm run zip` - Create ZIP package for Chrome
- `pnpm run zip:firefox` - Create ZIP package for Firefox
- `pnpm run zip:firefox:prod` - Create production ZIP package for Firefox
- `pnpm run compile` - Type check TypeScript without emitting files

---

Built with [WXT](https://wxt.dev) - The next generation framework for building cross-browser extensions.
