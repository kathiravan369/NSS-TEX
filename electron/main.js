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
let serverModule = null;
let mainWindow = null;

// Persistent file logger
let logFilePath = null;
function log(...args) {
  try {
    if (!logFilePath) {
      logFilePath = path.join(app.getPath('userData'), 'nss-erp.log');
    }
    const msg = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}\n`;
    fs.appendFileSync(logFilePath, msg);
  } catch (e) {}
  console.log(...args);
}

/**
 * Ping backend health endpoint to check readiness
 */
function pingBackendHealth(port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/health',
        method: 'GET',
        timeout: timeoutMs
      },
      (res) => {
        resolve(res.statusCode === 200 || res.statusCode === 503);
      }
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

/**
 * Wait for backend server to become responsive
 */
async function waitForBackendReady(port, maxWaitMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const ok = await pingBackendHealth(port, 700);
    if (ok) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/**
 * Automatically launch the Express/PostgreSQL backend server if not already running
 */
async function startBackendServer() {
  log(`Starting backend server initialization on port ${BACKEND_PORT}...`);

  // 1. Check if backend is already listening and responsive
  const alreadyRunning = await pingBackendHealth(BACKEND_PORT, 1000);
  if (alreadyRunning) {
    log(`Backend server is already running and responsive on port ${BACKEND_PORT}`);
    return true;
  }

  // 2. Try in-process execution via server module (primary & most reliable in packaged Electron)
  try {
    log('Attempting in-process backend startup...');
    try {
      serverModule = require('../backend/server.js');
    } catch (e1) {
      log('Direct require(../backend/server.js) note:', e1.message);
      const asarPath = path.join(process.resourcesPath, 'app.asar', 'backend', 'server.js');
      serverModule = require(asarPath);
    }

    if (serverModule && typeof serverModule.startServer === 'function') {
      log(`Calling serverModule.startServer(${BACKEND_PORT})...`);
      await serverModule.startServer(BACKEND_PORT);
      const ready = await waitForBackendReady(BACKEND_PORT, 8000);
      if (ready) {
        log('In-process backend server is verified healthy and ready.');
        return true;
      }
    }
  } catch (err) {
    log('In-process backend startup note:', err.message);
  }

  // 3. Fallback: Spawn as child process if in-process did not succeed
  try {
    log('Attempting child process spawn fallback...');
    const candidateScripts = [
      path.join(process.resourcesPath, 'app.asar', 'backend', 'server.js'),
      path.join(__dirname, '../backend/server.js'),
      path.join(process.resourcesPath, 'backend', 'server.js')
    ];

    const serverScript = candidateScripts.find((p) => fs.existsSync(p));

    if (serverScript) {
      const cwd = path.dirname(serverScript);
      backendProcess = fork(serverScript, [], {
        cwd,
        env: {
          ...process.env,
          PORT: BACKEND_PORT,
          NODE_ENV: app.isPackaged ? 'production' : 'development'
        },
        stdio: 'ignore'
      });

      log(`Spawned backend child process (PID: ${backendProcess.pid}) from: ${serverScript}`);

      backendProcess.on('error', (err) => {
        log('Backend child process error:', err.message);
      });
    } else {
      log('No backend script found in candidate locations.');
    }
  } catch (err) {
    log('Backend spawn error:', err.message);
  }

  // Wait for server readiness
  const isReady = await waitForBackendReady(BACKEND_PORT, 10000);
  log(`Backend readiness result: ${isReady}`);
  return isReady;
}

/**
 * Gracefully terminate backend server when Electron closes
 */
async function stopBackendServer() {
  log('Stopping backend server...');
  if (serverModule && typeof serverModule.stopServer === 'function') {
    try {
      await serverModule.stopServer();
      log('Stopped in-process backend server.');
    } catch (err) {
      log('Error stopping in-process backend:', err.message);
    }
    serverModule = null;
  }

  if (backendProcess && !backendProcess.killed) {
    try {
      backendProcess.kill('SIGTERM');
      backendProcess = null;
      log('Terminated backend child process.');
    } catch (err) {
      log('Error terminating backend child process:', err.message);
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
              message: 'NSS TOWELS & KD TEXT ERP',
              detail: 'Towels & Textiles Manufacturing Management System\nVersion 1.0.0\nBuilt with Electron, React, Express & PostgreSQL'
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
 * Load the React frontend into the browser window
 */
function loadFrontend(win) {
  if (!win || win.isDestroyed()) return;

  const distHtmlPath = path.join(__dirname, '../dist/index.html');

  if (!app.isPackaged && process.env.NODE_ENV !== 'production') {
    const req = http.request({ hostname: '127.0.0.1', port: 5173, method: 'HEAD', timeout: 800 }, () => {
      log('Loading Vite dev server at http://localhost:5173');
      win.loadURL('http://localhost:5173');
    });

    req.on('error', () => {
      if (fs.existsSync(distHtmlPath)) {
        log('Vite dev server not detected. Loading dist/index.html');
        win.loadFile(distHtmlPath);
      } else {
        win.loadURL('http://localhost:5173');
      }
    });

    req.end();
  } else {
    log(`Loading production build from: ${distHtmlPath}`);
    win.loadFile(distHtmlPath);
  }
}

/**
 * Create the main desktop application window
 */
function createWindow() {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.nsstowels.erp');
  }

  // Look for valid icon in candidate paths
  const candidateIconPaths = [
    path.join(process.resourcesPath, 'logo.ico'),
    path.join(process.resourcesPath, 'logo.png'),
    path.join(path.dirname(process.execPath), 'logo.ico'),
    path.join(__dirname, 'logo.ico'),
    path.join(__dirname, 'logo.png'),
    path.join(__dirname, '../public/logo.png'),
    path.join(__dirname, '../src/assets/logo.png'),
    path.join(__dirname, '../dist/logo.png')
  ];

  let appIcon = null;
  let resolvedIconPath = null;

  for (const candidate of candidateIconPaths) {
    try {
      if (fs.existsSync(candidate)) {
        const img = nativeImage.createFromPath(candidate);
        if (!img.isEmpty()) {
          appIcon = img;
          resolvedIconPath = candidate;
          log(`Successfully loaded application icon from: ${candidate}`);
          break;
        }
      }
    } catch (e) {
      log(`Error checking candidate icon ${candidate}:`, e.message);
    }
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'NSS-TEX ERP - Manufacturing Management System',
    icon: resolvedIconPath || appIcon || undefined,
    show: false,
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

  // Display initial loading state while backend server initializes
  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>NSS-TEX ERP</title>
      <style>
        body {
          margin: 0;
          background: #0f172a;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          user-select: none;
        }
        .spinner {
          width: 42px;
          height: 42px;
          border: 3px solid rgba(255,255,255,0.12);
          border-radius: 50%;
          border-top-color: #3b82f6;
          animation: spin 0.8s linear infinite;
          margin-bottom: 18px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .title { font-size: 19px; font-weight: 700; letter-spacing: 0.5px; }
        .subtitle { font-size: 13px; color: #94a3b8; margin-top: 6px; }
      </style>
    </head>
    <body>
      <div class="spinner"></div>
      <div class="title">NSS-TEX ERP</div>
      <div class="subtitle">Starting backend services & connecting to PostgreSQL...</div>
    </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(async () => {
  log('Electron app is ready.');
  createWindow();
  await startBackendServer();
  if (mainWindow && !mainWindow.isDestroyed()) {
    loadFrontend(mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      loadFrontend(mainWindow);
    }
  });
});

app.on('window-all-closed', async () => {
  log('Window all closed event.');
  await stopBackendServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  log('Before quit event.');
  await stopBackendServer();
});
