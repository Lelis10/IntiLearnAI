const { app, BrowserWindow, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8000';
const frontendDist = path.resolve(__dirname, '..', 'frontend', 'dist');
const indexHtmlPath = path.join(frontendDist, 'index.html');

const cspValue = `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' ${backendBaseUrl}`;

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

app.whenReady().then(() => {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
