const { app, BrowserWindow, nativeImage, shell, session } = require('electron');
const path = require('path');
const { fork } = require('child_process');

// Set Application Name & Windows App User Model ID for Taskbar icon recognition
app.setName('NSS-TEX ERP');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nsstowels.erp');
}

const BACKEND_PORT = process.env.PORT || 5001;
let backendProcess = null;

function startBackendServer() {
  const http = require('http');
  const checkReq = http.request(`http://localhost:${BACKEND_PORT}/api/health`, { method: 'GET', timeout: 800 }, () => {
    // Backend is already up and running
  });

  checkReq.on('error', () => {
    try {
      const serverScript = path.join(__dirname, '../backend/server.js');
      backendProcess = fork(serverScript, [], {
        env: { ...process.env, PORT: BACKEND_PORT },
        stdio: 'ignore'
      });

      backendProcess.on('error', (err) => {
        console.error('Failed to launch backend server:', err);
      });
    } catch (err) {
      console.warn('Backend server spawn bypassed:', err.message);
    }
  });

  checkReq.end();
}

function stopBackendServer() {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill('SIGTERM');
      backendProcess = null;
    } catch (err) {
      console.warn('Error terminating backend child process:', err.message);
    }
  }
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, 'logo.ico')
    : path.join(__dirname, 'logo.png');

  const appIcon = nativeImage.createFromPath(iconPath);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'NSS-TEX ERP - Towels & Textiles Manufacturing Management System',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (appIcon && !appIcon.isEmpty()) {
    win.setIcon(appIcon);
  }

  // Security: Prevent unintended in-app navigation and open external links in default OS browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDevUrl = navigationUrl.startsWith('http://localhost:5173') || navigationUrl.startsWith('http://127.0.0.1:5173');
    if (!isDevUrl && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  startBackendServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopBackendServer();
});
