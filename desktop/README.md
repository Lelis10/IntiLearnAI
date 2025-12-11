# IntiLearnAI Desktop Shell

This Electron shell wraps the existing frontend build output so it can run as a desktop application with secure defaults and a bridge to the backend API.

## How it works
- Loads the Vite production build from `../frontend/dist/index.html`.
- Creates a desktop window with a minimal menu and navigation protections. Add your own icon by placing `icon.png` in `desktop/assets/`.
- Exposes a safe IPC bridge (`window.desktopBridge`) for pings and HTTP calls to the backend defined by `BACKEND_BASE_URL` (defaults to `http://localhost:8000`).
- Blocks remote navigation, denies permission requests, and injects a strict Content Security Policy.

## Running locally
1. Build the frontend:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
2. Install the Electron shell dependencies:
   ```bash
   cd ../desktop
   npm install
   ```
3. Launch the desktop shell:
   ```bash
   npm start
   ```

Set `BACKEND_BASE_URL` before starting if the backend is not on `http://localhost:8000`.
