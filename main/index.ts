import path from 'path';
import { environment } from './env';
import { app, BrowserWindow } from 'electron';

if(!environment.production) {
  require('electron-reload')(
    path.join(__dirname, '../renderer/**/*'),
    {
      electron: path.resolve('node_modules/.bin/electron'),
    }
  );
}

export class Main {
  private mainWindow?: BrowserWindow;

  constructor() {
    app.addListener('ready', () => this.onAppReady());
  }

  private onAppReady() {
    this.mainWindow = new BrowserWindow({
      width: 1024,
      height: 624,
      webPreferences: {
        preload: path.join(__dirname, './preload.js'),
        contextIsolation: true,
      }
    });
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    if(!environment.production) {
      this.mainWindow.webContents.openDevTools({ mode: 'right' });
    }
  }

}

new Main();
