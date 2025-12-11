# IntiLearnAI Desktop Shell

This Electron shell wraps the existing frontend build output so it can run as a desktop application with secure defaults and a bridge to the backend API.

## How it works
- Loads the Vite production build from `../frontend/dist/index.html`.
- Creates a desktop window with a minimal menu and navigation protections. Add your own icon by placing `icon.png` in `desktop/assets/`.
- Exposes a safe IPC bridge (`window.desktopBridge`) for pings and HTTP calls to the backend defined by `BACKEND_BASE_URL` (defaults to `http://localhost:8000`).
- Blocks remote navigation, denies permission requests, and injects a strict Content Security Policy.
- Boots a bundled FastAPI/Uvicorn backend using a local Python virtual environment when no external `BACKEND_BASE_URL` is provided. The backend is started on an available port with health checks before the UI renders, and it shuts down gracefully when the app exits.

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

The app will reuse `BACKEND_BASE_URL` if set. Otherwise, it will create (or reuse) a Python virtual environment in `../.desktop-backend`, install `requirements.txt`, start `uvicorn app.main:app` on an available local port, and wait for a healthy response before loading the frontend.

Set `BACKEND_BASE_URL` before starting if the backend is not on `http://localhost:8000`.
