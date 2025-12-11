const { app, BrowserWindow, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');
const net = require('net');
const crypto = require('crypto');
const { pipeline } = require('stream');
const { promisify } = require('util');

const pipelineAsync = promisify(pipeline);

let backendBaseUrl = process.env.BACKEND_BASE_URL;
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
const indexHtmlPath = path.join(frontendDist, 'index.html');

let cspValue = `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' ${backendBaseUrl || ''}`;
let backendController = null;
let appSettings = null;

const MODEL_INFO = {
  filename: 'gemma-2-2b-it-Q4_K_M.gguf',
  url: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=1',
  description: 'Gemma 2 2B Instruct (Q4_K_M) — compact quantized model',
};

function getSettingsPath() {
  const userData = app.getPath('userData');
  return path.join(userData, 'settings.json');
}

function ensureDirectories(settings) {
  const modelDir = path.dirname(settings.modelPath);
  const cacheDir = settings.cachePath;
  fs.mkdirSync(modelDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });
}

function loadSettings() {
  if (appSettings) {
    return appSettings;
  }

  const defaults = {
    modelPath: path.join(app.getPath('userData'), 'models', MODEL_INFO.filename),
    cachePath: path.join(app.getPath('userData'), 'embeddings'),
  };

  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) {
    ensureDirectories(defaults);
    fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2));
    appSettings = defaults;
    return appSettings;
  }

  try {
    const contents = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(contents);
    appSettings = { ...defaults, ...parsed };
  } catch (error) {
    appSettings = defaults;
  }

  ensureDirectories(appSettings);
  return appSettings;
}

function saveSettings(nextSettings) {
  const current = loadSettings();
  appSettings = { ...current, ...nextSettings };
  ensureDirectories(appSettings);
  fs.writeFileSync(getSettingsPath(), JSON.stringify(appSettings, null, 2));
  return appSettings;
}

async function getDiskInfo(targetPath) {
  try {
    const probePath = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
    const stats = await fs.promises.statfs(probePath);
    return {
      freeBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  } catch (error) {
    return {
      freeBytes: os.freemem(),
      totalBytes: os.totalmem(),
      error: error.message,
    };
  }
}

function getModelStatus() {
  const settings = loadSettings();
  const exists = fs.existsSync(settings.modelPath);
  const sizeBytes = exists ? fs.statSync(settings.modelPath).size : 0;
  return { exists, path: settings.modelPath, sizeBytes, info: MODEL_INFO };
}

async function downloadModel(targetWindow) {
  const settings = loadSettings();
  const targetPath = settings.modelPath;
  const tempPath = `${targetPath}.partial`;

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const report = (payload) => {
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('model:download-progress', payload);
      }
    };

    const handleResponse = async (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        https.get(response.headers.location, handleResponse).on('error', reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Unexpected status code: ${response.statusCode}`));
        return;
      }

      const total = Number.parseInt(response.headers['content-length'] || '0', 10) || null;
      let downloaded = 0;
      const writeStream = fs.createWriteStream(tempPath);

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        const percent = total ? Math.round((downloaded / total) * 100) : null;
        report({ downloaded, total, percent });
      });

      response.on('error', (error) => {
        writeStream.destroy();
        fs.rm(tempPath, { force: true }, () => reject(error));
      });

      writeStream.on('error', (error) => {
        response.destroy();
        fs.rm(tempPath, { force: true }, () => reject(error));
      });

      writeStream.on('finish', () => {
        writeStream.close(async () => {
          try {
            await fs.promises.rename(tempPath, targetPath);
            report({ percent: 100, downloaded, total });
            resolve(targetPath);
          } catch (error) {
            reject(error);
          }
        });
      });

      pipelineAsync(response, writeStream).catch((error) => {
        fs.rm(tempPath, { force: true }, () => reject(error));
      });
    };

    https.get(MODEL_INFO.url, handleResponse).on('error', reject);
  });
}

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

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const content = fs.readFileSync(filePath);
  hash.update(content);
  return hash.digest('hex');
}

function getPythonBin(venvPath) {
  const binDir = process.platform === 'win32' ? 'Scripts' : 'bin';
  const executable = process.platform === 'win32' ? 'python.exe' : 'python';
  return path.join(venvPath, binDir, executable);
}

async function ensurePythonEnvironment(runtimeDir, requirementsPath) {
  const venvPath = path.join(runtimeDir, 'venv');
  if (!fs.existsSync(venvPath)) {
    const pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
    await runCommand(pythonCommand, ['-m', 'venv', venvPath]);
  }

  const pythonBin = getPythonBin(venvPath);
  const markerFile = path.join(runtimeDir, '.backend-ready');
  const requirementsHash = requirementsPath && fs.existsSync(requirementsPath)
    ? hashFile(requirementsPath)
    : null;
  const markerHash = fs.existsSync(markerFile)
    ? fs.readFileSync(markerFile, 'utf8').trim() || null
    : null;

  if (requirementsHash && requirementsHash !== markerHash) {
    await runCommand(pythonBin, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    await runCommand(pythonBin, ['-m', 'pip', 'install', '-r', requirementsPath]);
    fs.writeFileSync(markerFile, requirementsHash);
  }

  return { venvPath, pythonBin };
}

async function waitForBackendHealthy(baseUrl, retries = 120, delayMs = 500) {
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

async function startPackagedBackend(settings) {
  if (backendBaseUrl) {
    updateContentSecurityPolicy(backendBaseUrl);
    return { stop: async () => { } };
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

  const embeddingsRoot = path.join(settings.cachePath, 'collections');
  const manifestPath = path.join(settings.cachePath, 'index_manifest.json');

  const backendEnv = {
    ...process.env,
    VIRTUAL_ENV: path.join(runtimeDir, 'venv'),
    PATH: `${path.dirname(pythonBin)}${path.delimiter}${process.env.PATH}`,
    LLM_MODEL_PATH: settings.modelPath,
    EMBEDDINGS_ROOT: embeddingsRoot,
    EMBEDDINGS_MANIFEST: manifestPath,
    INDEX_DATA_ROOT: path.join(projectRoot, 'data'),
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

  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:update', (_event, updates) => saveSettings(updates || {}));
  ipcMain.handle('settings:choose-directory', async (_event, currentPath) => {
    const result = await dialog.showOpenDialog({
      title: 'Select folder',
      defaultPath: currentPath || app.getPath('home'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('storage:disk-info', (_event, targetPath) => getDiskInfo(targetPath || app.getPath('home')));
  ipcMain.handle('model:status', () => getModelStatus());
  ipcMain.handle('model:download', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    try {
      const modelPath = await downloadModel(window);
      return { ok: true, path: modelPath };
    } catch (error) {
      window.webContents.send('model:download-progress', { error: error.message });
      return { ok: false, error: error.message };
    }
  });

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

  ipcMain.on('app:start-chat-stream', async (event, { route, body }) => {
    if (!backendBaseUrl) {
      event.sender.send('chat:error', 'Backend not connected');
      return;
    }

    try {
      const target = new URL(route.startsWith('/') ? route.slice(1) : route, backendBaseUrl);
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        event.sender.send('chat:error', `HTTP Error: ${response.status}`);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        event.sender.send('chat:chunk', chunk);
      }

      event.sender.send('chat:end');
    } catch (error) {
      event.sender.send('chat:error', error.message);
    }
  });
}

app.whenReady().then(async () => {
  appSettings = loadSettings();

  try {
    backendController = await startPackagedBackend(appSettings);
  } catch (error) {
    dialog.showErrorBox('Backend failed to start', error.message);
    app.quit();
    return;
  }

  registerIpcHandlers();
  const mainWindow = createWindow();

  const modelStatus = getModelStatus();
  if (!modelStatus.exists) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('model:download-progress', {
        missing: true,
        info: MODEL_INFO,
      });
    });
  }

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
