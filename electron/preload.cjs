// Preload bridges.
//   - genStudioDesktop: read-only marker so the web UI can tell it runs in the
//     desktop shell.
//   - genStudioSetup: used ONLY by the first-run setup window (setup.html) to
//     drive the Python provisioning and stream progress. Harmless elsewhere.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('genStudioDesktop', {
  isDesktop: true,
  platform: process.platform,
  version: process.env.npm_package_version || null,
});

contextBridge.exposeInMainWorld('genStudioSetup', {
  // Kick off provisioning. opts: { rigging: boolean }. Resolves to { ok, error }.
  run: (opts) => ipcRenderer.invoke('setup:run', opts),
  // Which services are provisioned: { desktop, meshtools, rigging }.
  status: () => ipcRenderer.invoke('setup:status'),
  // Subscribe to progress events: { service, kind, phase, pct, text }.
  // Returns an unsubscribe function.
  onProgress: (cb) => {
    const handler = (_e, evt) => cb(evt);
    ipcRenderer.on('setup:progress', handler);
    return () => ipcRenderer.removeListener('setup:progress', handler);
  },
  // Tell the main process the user is done and the app can launch (first-run window).
  finish: () => ipcRenderer.send('setup:finish'),
});
