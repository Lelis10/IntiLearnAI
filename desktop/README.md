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

## Packaging and distribution

### Electron (electron-builder)
1. Build the frontend (`npm run build` inside `frontend`). The packaged app expects the assets in `frontend/dist/`.
2. From `desktop/`, install dependencies (requires internet access):
   ```bash
   npm install
   ```
3. Produce installers:
   - Windows NSIS `.exe`:
     ```bash
     npm run dist:win
     ```
   - macOS `.dmg` and `.pkg`:
     ```bash
     npm run dist:mac
     ```
   - Linux `.AppImage`, `.deb`, and `.rpm`:
     ```bash
     npm run dist:linux
     ```

The `electron-builder` configuration in `package.json` wires the app ID, product name, icons from `assets/icon.png`, and includes the production frontend build. Outputs are placed in `desktop/dist/`.

**Code signing and updates**
- Set your platform-specific signing credentials (for example `CSC_LINK`/`CSC_KEY_PASSWORD` on macOS or `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` on Windows) before running the `dist:*` scripts so installers ship signed binaries.
- If you plan to ship auto-updates, configure a publish target (e.g., GitHub Releases, S3) in the `build` block and enable Electron's `autoUpdater` in the renderer.

### Alternative: Tauri
If you later wrap the same frontend with Tauri to take advantage of the smaller Rust runtime, create a Tauri workspace that serves `frontend/dist/` and run:
```bash
tauri build
```
This will generate platform installers using Tauri's updater/signing configuration.

### Troubleshooting

#### `npm install` crashes with 403 Forbidden
If you see `registry returned 403 Forbidden` for `electron-builder`:
1. **Clear npm cache**: `npm cache clean --force`
2. **Check proxy settings**: Ensure you aren't behind a corporate proxy blocking the registry.
3. **Use a different registry**: try `npm config set registry https://registry.npmjs.org/`
4. **Manual Binary Download**: `electron-builder` attempts to download binaries. If it fails, check your internet connection or firewall.

#### Build errors (7zip / EPERM)
If `npm run dist:*` fails with file permission errors:
- Close any VS Code instances or terminals that might be locking files in `dist/`.
- Run the terminal as Administrator.
- If it persists, delete the `desktop/dist/` folder manually and try again.

#### Build Error: "Cannot create symbolic link"
If you see `ERROR: Cannot create symbolic link : A required privilege is not held by the client`:
1.  **Enable Developer Mode**: Go to **Windows Settings > Privacy & security > For developers**, and enable **Developer Mode**. This allows non-admin users to create symbolic links required by the build tools.
2.  **Run as Administrator**: Alternatively, open your terminal (PowerShell/CMD) as Administrator and run the command again.

