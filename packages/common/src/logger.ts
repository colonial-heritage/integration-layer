import {pino} from 'pino';

export function getLogger() {
  return pino({
    base: {
      name: undefined, // Don't log PID and hostname
    },
    messageKey: 'message',
    formatters: {
      level(label: string) {
        return {
          level: label,
        };
      },
    },
  });
}
