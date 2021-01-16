import fs from 'fs';
import path from 'path';
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld(
  'api',
  {
    fs,
    path,
  },
);
