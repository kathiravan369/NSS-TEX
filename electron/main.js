const { app, BrowserWindow, nativeImage, shell, Menu } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { fork } = require('child_process');

// Set Application Name & Windows App User Model ID for Taskbar icon recognition
app.setName('NSS-TEX ERP');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.nsstowels.erp');
}

const BACKEND_PORT = process.env.PORT || 5001;
let backendProcess = null;
let mainWindow = null;

/**
 * Automatically launch the Express/PostgreSQL backend server if not already running
 */
function startBackendServer() {
  const checkReq = http.request(
    `http://localhost:${BACKEND_PORT}/api/health`,
    { method: 'GET', timeout: 1000 },
    () => {
      console.log(`[Electron] Backend server is already running on port ${BACKEND_PORT}`);
    }
  );

  checkReq.on('error', () => {
    try {
      const serverScript = app.isPackaged
        ? path.join(process.resourcesPath, 'backend', 'server.js')
        : path.join(__dirname, '../backend/server.js');

      if (!fs.existsSync(serverScript)) {
        console.warn(`[Electron] Backend script not found at: ${serverScript}`);
        return;
      }

      const cwd = path.dirname(serverScript);

      backendProcess = fork(serverScript, [], {
        cwd,
        env: { ...process.env, PORT: BACKEND_PORT, NODE_ENV: app.isPackaged ? 'production' : 'development' },
        stdio: 'ignore'
      });

      console.log(`[Electron] Spawned backend server process (PID: ${backendProcess.pid}) from ${serverScript}`);

      backendProcess.on('error', (err) => {
        console.error('[Electron] Failed to launch backend server child process:', err);
      });
    } catch (err) {
      console.warn('[Electron] Backend server spawn error:', err.message);
    }
  });

  checkReq.end();
}

/**
 * Gracefully terminate backend child process when Electron closes
 */
function stopBackendServer() {
  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill('SIGTERM');
      backendProcess = null;
      console.log('[Electron] Terminated backend server process.');
    } catch (err) {
      console.warn('[Electron] Error terminating backend child process:', err.message);
    }
  }
}

/**
 * Create application menu
 */
function createMenu(win) {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win.reload() },
        { label: 'Force Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => win.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => win.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About NSS-TEX ERP',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About NSS-TEX ERP',
              message: 'NSS TOWELS / TexMan ERP',
              detail: 'Towels & Textiles Manufacturing Management System\nVersion 1.0.0\nBuilt with Electron, React, & PostgreSQL'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Create the main desktop application window
 */
function createWindow() {
  // Look for valid icon in candidate paths (supports both .ico and .png on Windows)
  const candidateIconPaths = [
    path.join(__dirname, 'logo.ico'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, '../public/logo.png'),
    path.join(__dirname, '../src/assets/logo.png'),
    path.join(__dirname, '../dist/logo.png')
  ];

  let appIcon = null;
  for (const candidate of candidateIconPaths) {
    if (fs.existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate);
      if (!img.isEmpty()) {
        appIcon = img;
        break;
      }
    }
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'NSS-TEX ERP - Manufacturing Management System',
    icon: appIcon || undefined,
    show: false, // Show when ready to prevent visual flickering
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (appIcon && !appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon);
  }

  createMenu(mainWindow);

  // Security: Prevent unintended in-app navigation and open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const isDevUrl = navigationUrl.startsWith('http://localhost:5173') || navigationUrl.startsWith('http://127.0.0.1:5173');
    if (!isDevUrl && !navigationUrl.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Intelligent loader: If Vite dev server is running on 5173, load it; otherwise load built dist/index.html
  const distHtmlPath = path.join(__dirname, '../dist/index.html');

  if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
    const req = http.request('http://localhost:5173', { method: 'HEAD', timeout: 700 }, (res) => {
      mainWindow.loadURL('http://localhost:5173');
    });

    req.on('error', () => {
      if (fs.existsSync(distHtmlPath)) {
        console.log('[Electron] Vite dev server not detected. Loading production build from dist/index.html');
        mainWindow.loadFile(distHtmlPath);
      } else {
        mainWindow.loadURL('http://localhost:5173');
      }
    });

    req.end();
  } else {
    mainWindow.loadFile(distHtmlPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
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
