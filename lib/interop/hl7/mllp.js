'use strict';

const net = require('net');
const tls = require('tls');

const VT = 0x0b;
const FS = 0x1c;
const CR = 0x0d;

function wrapMllp(payload) {
  const body = Buffer.from(payload.replace(/\r\n/g, '\r').replace(/\n/g, '\r'), 'utf8');
  return Buffer.concat([Buffer.from([VT]), body, Buffer.from([FS, CR])]);
}

function unwrapMllp(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  let start = 0;
  let end = buf.length;
  if (buf[0] === VT) start = 1;
  if (buf[buf.length - 2] === FS && buf[buf.length - 1] === CR) end = buf.length - 2;
  else if (buf[buf.length - 1] === FS) end = buf.length - 1;
  return buf.slice(start, end).toString('utf8');
}

/**
 * Send HL7 message over MLLP (optionally TLS)
 * @returns {Promise<{ ack: string, ackParsed: object|null }>}
 */
function sendMllp({ host, port, message, useTls = false, timeoutMs = 30000 }) {
  return new Promise((resolve, reject) => {
    const framed = wrapMllp(message);
    let responseBuffer = Buffer.alloc(0);

    const onData = (chunk) => {
      responseBuffer = Buffer.concat([responseBuffer, chunk]);
      if (responseBuffer.includes(FS)) {
        cleanup();
        try {
          const ack = unwrapMllp(responseBuffer);
          resolve({ ack, raw: responseBuffer });
        } catch (err) {
          reject(err);
        }
      }
    };

    const socket = useTls
      ? tls.connect({ host, port, rejectUnauthorized: process.env.INTEROP_TLS_REJECT_UNAUTHORIZED !== 'false' })
      : net.createConnection({ host, port });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`MLLP timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
    }

    socket.on('data', onData);
    socket.on('error', (err) => {
      cleanup();
      reject(err);
    });
    socket.on('connect', () => {
      socket.write(framed);
    });
  });
}

module.exports = { wrapMllp, unwrapMllp, sendMllp, VT, FS, CR };
