const { contextBridge, ipcRenderer } = require('electron');

function sanitizeOptions(options) {
  if (!options || typeof options !== 'object') {
    return {};
  }
  return JSON.parse(JSON.stringify(options));
}

contextBridge.exposeInMainWorld('desktopBridge', {
  ping: () => ipcRenderer.invoke('app:ping'),
  request: (route, options) => {
    return ipcRenderer.invoke('app:http', route, sanitizeOptions(options));
  },
  streamChat: (payload) => ipcRenderer.send('app:start-chat-stream', { route: '/chat', body: payload }),
  onChatChunk: (callback) => ipcRenderer.on('chat:chunk', (_event, chunk) => callback(chunk)),
  onChatEnd: (callback) => ipcRenderer.on('chat:end', (_event) => callback()),
  onChatError: (callback) => ipcRenderer.on('chat:error', (_event, error) => callback(error)),
  removeChatListeners: () => {
    ipcRenderer.removeAllListeners('chat:chunk');
    ipcRenderer.removeAllListeners('chat:end');
    ipcRenderer.removeAllListeners('chat:error');
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:update', sanitizeOptions(settings)),
  chooseDirectory: (currentPath) => ipcRenderer.invoke('settings:choose-directory', currentPath),
  getDiskInfo: (targetPath) => ipcRenderer.invoke('storage:disk-info', targetPath),
  getModelStatus: () => ipcRenderer.invoke('model:status'),
  downloadModel: () => ipcRenderer.invoke('model:download'),
  onModelDownloadProgress: (callback) => ipcRenderer.on('model:download-progress', (_event, data) => callback(data)),
  removeModelDownloadProgress: () => ipcRenderer.removeAllListeners('model:download-progress'),
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),
  onBackendStatus: (callback) => ipcRenderer.on('backend:status', (_event, status) => callback(status)),
  removeBackendStatus: () => ipcRenderer.removeAllListeners('backend:status'),
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  revealInFolder: (targetPath) => ipcRenderer.invoke('file:reveal', targetPath),
});
