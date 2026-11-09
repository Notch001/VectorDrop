const { app, BrowserWindow, Menu, shell, dialog, ipcMain } = require('electron');
const path = require('path');

let win = null;
let manualCheck = false;
// Automatische Updates gibt es nur in der installierten Version (nicht portabel, nicht im Entwicklungsmodus)
const updatesSupported = app.isPackaged && !process.env.PORTABLE_EXECUTABLE_FILE;
let autoUpdater = null;

function setupUpdater() {
  if (!updatesSupported) return;
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', async (info) => {
    manualCheck = false;
    const r = await dialog.showMessageBox(win, {
      type: 'info', title: 'Update verfügbar', buttons: ['Jetzt herunterladen', 'Später'], defaultId: 0, cancelId: 1,
      message: 'Version ' + info.version + ' von VectorDrop ist verfügbar.',
      detail: 'Du verwendest Version ' + app.getVersion() + '. Das Update wird im Hintergrund geladen, du kannst weiterarbeiten.',
    });
    if (r.response === 0) autoUpdater.downloadUpdate().catch(() => {});
  });
  autoUpdater.on('update-not-available', () => {
    if (manualCheck) dialog.showMessageBox(win, { type: 'info', title: 'Keine Updates', message: 'Du verwendest bereits die neueste Version (' + app.getVersion() + ').' });
    manualCheck = false;
  });
  autoUpdater.on('download-progress', (p) => win && win.setProgressBar(p.percent / 100));
  autoUpdater.on('update-downloaded', async (info) => {
    if (win) win.setProgressBar(-1);
    const r = await dialog.showMessageBox(win, {
      type: 'question', title: 'Update bereit', buttons: ['Neu starten und installieren', 'Beim nächsten Beenden'], defaultId: 0, cancelId: 1,
      message: 'Version ' + info.version + ' ist heruntergeladen.',
      detail: 'Ungespeicherte Arbeit bleibt erhalten (dein Design wird automatisch gesichert).',
    });
    if (r.response === 0) autoUpdater.quitAndInstall();
    else autoUpdater.autoInstallOnAppQuit = true;
  });
  autoUpdater.on('error', (e) => {
    if (win) win.setProgressBar(-1);
    if (manualCheck) dialog.showErrorBox('Update-Suche fehlgeschlagen', String((e && e.message) || e));
    manualCheck = false;
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 4000);                 // kurz nach dem Start
  setInterval(check, 4 * 60 * 60 * 1000);  // danach alle 4 Stunden
}

ipcMain.handle('app-info', () => ({ version: app.getVersion(), updates: updatesSupported, portable: !!process.env.PORTABLE_EXECUTABLE_FILE }));
ipcMain.handle('check-updates', () => {
  if (!updatesSupported) return { supported: false };
  manualCheck = true;
  autoUpdater.checkForUpdates().catch(() => {});
  return { supported: true };
});

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1000, minHeight: 600,
    title: 'VectorDrop', backgroundColor: '#f4f5f7',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
}

app.whenReady().then(() => { createWindow(); setupUpdater(); });
app.on('window-all-closed', () => app.quit());
