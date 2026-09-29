const STOP_COMMANDS = new Set([
  'stop', 'stop please', 'please stop', 'stop talking', 'stop speaking',
  'please stop talking', 'please stop speaking', 'be quiet', 'quiet',
  'vera stop', 'stop vera', 'thats enough', 'that is enough',
]);

export function isStopCommand(text) {
  const normalized = String(text || '').toLowerCase()
    .replace(/['’]/g, '').replace(/[^a-z0-9\s]/g, ' ').trim().replace(/\s+/g, ' ');
  return STOP_COMMANDS.has(normalized);
}
