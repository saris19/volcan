const serviceTag = process.env.SERVICE || 'service';

function write(level, message) {
  // JSON line logs: Cloud Logging parses them automatically.
  console.log(JSON.stringify({ severity: level, service: serviceTag, message, time: new Date().toISOString() }));
}

export const logger = {
  info: (message) => write('INFO', message),
  warn: (message) => write('WARNING', message),
  error: (message) => write('ERROR', message),
};
