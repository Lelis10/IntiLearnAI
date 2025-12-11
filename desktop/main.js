const { app, BrowserWindow, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const net = require('net');

let backendBaseUrl = process.env.BACKEND_BASE_URL;
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
const indexHtmlPath = path.join(frontendDist, 'index.html');

let cspValue = `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' ${backendBaseUrl || ''}`;
let backendController = null;

function updateContentSecurityPolicy(baseUrl) {
  const sanitizedBase = baseUrl || '';
  cspValue = `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' ${sanitizedBase}`;
}

function createMenu(window) {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => window.webContents.reload(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'CmdOrCtrl+Shift+I',
          visible: !app.isPackaged,
          click: () => window.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Show App Location',
          click: () => {
            const shell = require('electron').shell;
            shell.showItemInFolder(__filename);
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function findAvailablePort(preferredPort = 8000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    let fallbackTried = false;

    const tryListen = (portToTry) => {
      server.once('listening', () => {
        const { port } = server.address();
        server.close(() => resolve(port));
      });

      server.once('error', (error) => {
        server.removeAllListeners('listening');
        if (!fallbackTried && preferredPort) {
          fallbackTried = true;
          tryListen(0);
        } else {
          reject(error);
        }
      });

      server.listen(portToTry, '127.0.0.1');
    };

    tryListen(preferredPort || 0);
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

function getPythonBin(venvPath) {
  const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const executable = process.platform === 'win32' ? 'python.exe' : 'python';
  return path.join(venvPath, binDir, executable);
}

async function ensurePythonEnvironment(runtimeDir, requirementsPath) {
  const venvPath = path.join(runtimeDir, 'venv');
  if (!fs.existsSync(venvPath)) {
    await runCommand('python3', ['-m', 'venv', venvPath]);
  }

  const pythonBin = getPythonBin(venvPath);
  const markerFile = path.join(runtimeDir, '.backend-ready');
  if (requirementsPath && fs.existsSync(requirementsPath) && !fs.existsSync(markerFile)) {
    await runCommand(pythonBin, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    await runCommand(pythonBin, ['-m', 'pip', 'install', '-r', requirementsPath]);
    fs.writeFileSync(markerFile, `Dependencies installed at ${new Date().toISOString()}\n`);
  }

  return { venvPath, pythonBin };
}

async function waitForBackendHealthy(baseUrl, retries = 10, delayMs = 500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Retry
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function startPackagedBackend() {
  if (backendBaseUrl) {
    updateContentSecurityPolicy(backendBaseUrl);
    return { stop: async () => {} };
  }

  const projectRoot = path.resolve(__dirname, '..');
  const backendSourcePath = projectRoot;
  const runtimeDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'backend')
    : path.join(projectRoot, '.desktop-backend');

  if (!fs.existsSync(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }

  const requirementsPath = path.join(projectRoot, 'requirements.txt');
  const { pythonBin } = await ensurePythonEnvironment(runtimeDir, requirementsPath);
  const port = await findAvailablePort(8000);

  const backendEnv = {
    ...process.env,
    VIRTUAL_ENV: path.join(runtimeDir, 'venv'),
    PATH: `${path.dirname(pythonBin)}${path.delimiter}${process.env.PATH}`,
  };

  const args = ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', `${port}`];
  const child = spawn(pythonBin, args, {
    cwd: backendSourcePath,
    env: backendEnv,
    stdio: app.isPackaged ? 'ignore' : 'inherit',
  });

  backendBaseUrl = `http://127.0.0.1:${port}`;
  updateContentSecurityPolicy(backendBaseUrl);

  const healthy = await waitForBackendHealthy(backendBaseUrl);
  if (!healthy) {
    if (child && !child.killed) {
      child.kill();
    }
    throw new Error('Backend did not become healthy in time');
  }

  const stop = async () => {
    if (child && !child.killed) {
      child.kill();
    }
  };

  return { stop };
}

function secureWebContents(contents) {
  const { session } = contents;
  if (!session) return;
  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    if (url !== contents.getURL()) {
      event.preventDefault();
    }
  });

  session.webRequest.onHeadersReceived((details, callback) => {
    const headers = {
      ...details.responseHeaders,
      'Content-Security-Policy': [cspValue],
      'Cross-Origin-Opener-Policy': ["same-origin"],
      'Cross-Origin-Embedder-Policy': ["require-corp"],
    };
    callback({ responseHeaders: headers });
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  const hasIcon = fs.existsSync(iconPath);
  const iconImage = hasIcon ? nativeImage.createFromPath(iconPath) : null;

  const mainWindow = new BrowserWindow({
    title: 'IntiLearnAI Desktop',
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    icon: iconImage && !iconImage.isEmpty() ? iconImage : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  createMenu(mainWindow);
  secureWebContents(mainWindow.webContents);

  if (fs.existsSync(indexHtmlPath)) {
    mainWindow.loadFile(indexHtmlPath);
  } else {
    const errorHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Build missing</title></head><body><h1>Frontend build not found</h1><p>Create the production build with <code>npm run build</code> in the frontend directory.</p></body></html>`;
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
  }

  return mainWindow;
}

async function forwardHttpRequest(route, options = {}) {
  const normalizedRoute = route.startsWith('/') ? route.slice(1) : route;
  if (!backendBaseUrl) {
    throw new Error('Backend URL not configured');
  }
  const target = new URL(normalizedRoute, backendBaseUrl);
  const requestInit = {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body,
  };

  if (requestInit.body && typeof requestInit.body === 'object' && !(requestInit.body instanceof Buffer)) {
    requestInit.body = JSON.stringify(requestInit.body);
    if (!requestInit.headers['Content-Type']) {
      requestInit.headers['Content-Type'] = 'application/json';
    }
  }

  const response = await fetch(target, requestInit);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  return {
    ok: response.ok,
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    data: payload,
    url: target.toString(),
  };
}

function registerIpcHandlers() {
  ipcMain.handle('app:ping', () => ({
    ok: true,
    timestamp: new Date().toISOString(),
  }));

  ipcMain.handle('app:http', async (_event, route, options) => {
    try {
      return await forwardHttpRequest(route, options);
    } catch (error) {
      return {
        ok: false,
        status: 500,
        error: error.message,
      };
    }
  });
}

app.whenReady().then(async () => {
  try {
    backendController = await startPackagedBackend();
  } catch (error) {
    dialog.showErrorBox('Backend failed to start', error.message);
    app.quit();
    return;
  }

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    const [existingWindow] = BrowserWindow.getAllWindows();
    if (!existingWindow) {
      createWindow();
    } else {
      existingWindow.focus();
    }
  });
});

app.on('before-quit', async () => {
  if (backendController) {
    await backendController.stop();
    backendController = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
