type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  component?: string;
  action?: string;
  data?: any;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString().slice(11, 23); // HH:mm:ss.sss
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (context?.component) {
      const componentPrefix = `[${context.component}]`;
      if (context.action) {
        return `${prefix} ${componentPrefix} ${context.action}: ${message}`;
      }
      return `${prefix} ${componentPrefix} ${message}`;
    }
    
    return `${prefix} ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.isDevelopment) {
      return level === 'error' || level === 'warn';
    }
    return true;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context), context?.data);
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, context), context?.data);
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context), context?.data);
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, context), error, context?.data);
    }
  }

  // Canvas-specific logging methods
  canvas = {
    operation: (operation: string, details?: any) => {
      this.debug(`Canvas operation: ${operation}`, { 
        component: 'Canvas', 
        action: operation,
        data: details 
      });
    },

    render: (message: string, data?: any) => {
      this.debug(message, { 
        component: 'Canvas', 
        action: 'render',
        data 
      });
    },

    event: (eventType: string, coordinates?: { x: number; y: number }) => {
      this.debug(`Event: ${eventType}`, {
        component: 'Canvas',
        action: 'event',
        data: coordinates
      });
    },

    state: (message: string, state?: any) => {
      this.debug(`State change: ${message}`, {
        component: 'Canvas',
        action: 'state',
        data: state
      });
    }
  };

  // Redux-specific logging methods
  redux = {
    action: (actionType: string, payload?: any) => {
      this.debug(`Action dispatched: ${actionType}`, {
        component: 'Redux',
        action: actionType,
        data: payload
      });
    },

    stateChange: (message: string, state?: any) => {
      this.debug(`State change: ${message}`, {
        component: 'Redux',
        action: 'state-change',
        data: state
      });
    }
  };

  // URL/Sharing specific logging
  url = {
    load: (message: string, data?: any) => {
      this.info(`URL Loading: ${message}`, {
        component: 'URLService',
        action: 'load',
        data
      });
    },

    encode: (message: string, data?: any) => {
      this.debug(`URL Encoding: ${message}`, {
        component: 'URLService', 
        action: 'encode',
        data
      });
    },

    decode: (message: string, data?: any) => {
      this.debug(`URL Decoding: ${message}`, {
        component: 'URLService',
        action: 'decode', 
        data
      });
    }
  };

  // History/Undo specific logging
  history = {
    add: (item: any) => {
      this.debug(`History item added`, {
        component: 'History',
        action: 'add',
        data: item
      });
    },

    undo: (historyLength: number) => {
      this.debug(`Undo performed`, {
        component: 'History',
        action: 'undo',
        data: { historyLength }
      });
    },

    replay: (itemCount: number) => {
      this.debug(`History replay started`, {
        component: 'History',
        action: 'replay',
        data: { itemCount }
      });
    }
  };

  // Performance logging
  perf = {
    start: (operation: string) => {
      const label = `perf:${operation}`;
      console.time(label);
      return label;
    },

    end: (label: string) => {
      console.timeEnd(label);
    },

    measure: <T>(operation: string, fn: () => T): T => {
      const label = this.perf.start(operation);
      try {
        return fn();
      } finally {
        this.perf.end(label);
      }
    }
  };
}

export const logger = new Logger();