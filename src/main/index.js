/* eslint-disable no-underscore-dangle */
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  shell,
  ipcMain,
  screen
} from "electron";
import path from "path";
import { autoUpdater } from "electron-updater";
import log from "electron-log";

const electronLocalshortcut = require("electron-localshortcut");
const Store = require("electron-store");

const store = new Store();

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";
log.info("App starting...");

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== "development") {
  global.__static = path.join(__dirname, "/static").replace(/\\/g, "\\\\");
}

let tray = null;
let contextMenu = null;
let mainWindow = null;
const winURL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`;

const iconpath = path.join(
  __static,
  `icon.${process.platform === "win32" ? "ico" : "png"}`
);

function handleLinks(link) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("linkHandler", link);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    minHeight: 550,
    minWidth: 800,
    frame: false,
    transparent: true,
    resizable: true,
    webPreferences: {
      disableBlinkFeatures: "Auxclick",
      webSecurity: process.env.NODE_ENV !== "development",
      allowRunningInsecureContent: false
    },
    show: false
  });

  mainWindow.loadURL(winURL);
  mainWindow.setMenu(null);
  mainWindow.on("minimize", event => {
    event.preventDefault();
    mainWindow.minimize();
  });

  mainWindow.on("ready-to-show", () => {
    if (!store.get("config.startminimize", false)) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Protocol handler for win32
  if (process.platform === "win32") {
    handleLinks(process.argv.pop());
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  tray = new Tray(iconpath);
  contextMenu = Menu.buildFromTemplate([
    {
      label: "Open WeakAuras Companion",
      click: () => {
        mainWindow.show();
      }
    },
    {
      label: "Check for Companion Updates",
      click: () => {
        autoUpdater.checkForUpdatesAndNotify();
      }
    },
    { type: "separator" },
    {
      label: "Fetch Updates",
      click: () => {
        mainWindow.webContents.send("refreshWago");
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.webContents.on("new-window", (event, url) => {
    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.webContents.on("will-navigate", event => {
    if (mainWindow.webContents.getURL() !== winURL) {
      event.preventDefault();
    }
  });

  electronLocalshortcut.register(mainWindow, "Ctrl+Shift+I", () => {
    mainWindow.webContents.openDevTools();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (event, argv) => {
    // Protocol handler for win32
    if (process.platform === "win32") {
      handleLinks(argv.pop());
    }
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });

  app.on("ready", () => {
    createWindow();
    if (process.env.NODE_ENV === "production")
      autoUpdater.checkForUpdatesAndNotify();
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// important for notifications on Windows
app.setAppUserModelId("wtf.weakauras.companion");
app.setAsDefaultProtocolClient("weakauras-companion");

// Protocol handler for osx
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleLinks(url);
});

// event use when clicking on notifications
ipcMain.on("open", () => {
  mainWindow.show();
  mainWindow.focus();
});
ipcMain.on("minimize", () => {
  mainWindow.hide();
});
ipcMain.on("close", () => {
  app.isQuiting = true;
  app.quit();
});
ipcMain.on("installUpdates", () => {
  autoUpdater.quitAndInstall();
});
ipcMain.on("windowMoving", (e, { mouseX, mouseY }) => {
  const { x, y } = screen.getCursorScreenPoint();
  mainWindow.setPosition(x - mouseX, y - mouseY);
});

// updater functions
autoUpdater.on("checking-for-update", () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("updaterHandler", "checking-for-update");
  }
});
autoUpdater.on("update-available", () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("updaterHandler", "update-available");
  }
});
autoUpdater.on("update-not-available", () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("updaterHandler", "update-not-available");
  }
});
autoUpdater.on("error", err => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("updaterHandler", "error", err);
    mainWindow.setProgressBar(-1);
  }
});
autoUpdater.on("download-progress", progressObj => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(
      "updaterHandler",
      "download-progress",
      progressObj
    );
    mainWindow.setProgressBar(progressObj.percent / 100);
  }
});
autoUpdater.on("update-downloaded", () => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send("updaterHandler", "update-downloaded");
    mainWindow.setProgressBar(-1);
  }
});
