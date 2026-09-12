/** Terminal copy shared by the plugin and the standalone script. */
export function launchBanner(org: { name: string; username: string }): string {
  return [
    'Quotivity CPQ Inventory',
    `Connected to: ${org.name} (${org.username})`,
    '',
    'This runs entirely on your machine. Opening your browser...',
  ].join('\n');
}

export function readyLine(url: string): string {
  return `Report served at ${url} — bound to 127.0.0.1 only. Press Ctrl-C to stop.`;
}
