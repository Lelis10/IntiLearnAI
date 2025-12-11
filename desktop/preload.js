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
});
