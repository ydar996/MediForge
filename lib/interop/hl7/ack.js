'use strict';

const { escapeHl7, formatTimestamp } = require('./encoding');

/**
 * Generate HL7 ACK message
 * @param {{ inboundMsh: object, ackCode?: 'AA'|'AE'|'AR', textMessage?: string }} params
 */
function generateAck({ inboundMsh, ackCode = 'AA', textMessage = '' }) {
  if (!inboundMsh) throw new Error('inboundMsh required for ACK');

  const ts = formatTimestamp();
  const controlId = inboundMsh.messageControlId || 'UNKNOWN';
  const msgTypeParts = (inboundMsh.messageType || '').split('^');
  const trigger = msgTypeParts[0] || 'ORM';
  const event = msgTypeParts[1] || 'O01';

  const msh =
    `MSH|^~\\&|${escapeHl7(inboundMsh.receivingApplication || 'MEDIFORGE')}|` +
    `${escapeHl7(inboundMsh.receivingFacility || 'CLINIC')}|` +
    `${escapeHl7(inboundMsh.sendingApplication || 'LIS')}|` +
    `${escapeHl7(inboundMsh.sendingFacility || 'LAB')}|` +
    `${ts}||ACK^${event}|ACK${Date.now()}|P|2.5`;

  const msa = `MSA|${ackCode}|${escapeHl7(controlId)}|${escapeHl7(textMessage)}`;

  return `${msh}\r${msa}`;
}

function isPositiveAck(ackCode) {
  return ackCode === 'AA';
}

module.exports = { generateAck, isPositiveAck };
