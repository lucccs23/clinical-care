const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('painelApp', {
  info: () => ipcRenderer.invoke('update:info'),
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  onState: (listener) => ipcRenderer.on('update:state', (_event, state) => listener(state)),
});
