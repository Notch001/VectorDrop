const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('vd', {
  info: () => ipcRenderer.invoke('app-info'),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
});
