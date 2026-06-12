'use strict';

const { unescapeHl7, splitComponents } = require('./encoding');

/**
 * Parse HL7 v2 message string into structured object.
 * @param {string} raw
 * @returns {{ segments: Array<{name:string, fields:string[]}>, msh: object|null }}
 */
function parseMessage(raw) {
  const normalized = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r').trim();
  const lines = normalized.split('\r').filter(Boolean);
  const segments = lines.map((line) => {
    const parts = line.split('|');
    const name = parts[0];
    const fields = parts.slice(1).map(unescapeHl7);
    return { name, fields };
  });

  const mshSeg = segments.find((s) => s.name === 'MSH');
  let msh = null;
  if (mshSeg) {
    msh = {
      sendingApplication: splitComponents(mshSeg.fields[1] || '')[0] || '',
      sendingFacility: splitComponents(mshSeg.fields[1] || '')[1] || '',
      receivingApplication: splitComponents(mshSeg.fields[2] || '')[0] || '',
      receivingFacility: splitComponents(mshSeg.fields[2] || '')[1] || '',
      dateTime: mshSeg.fields[5] || '',
      messageType: mshSeg.fields[7] || '',
      messageControlId: mshSeg.fields[8] || '',
      processingId: mshSeg.fields[9] || 'P',
      version: mshSeg.fields[10] || '2.5'
    };
  }

  return { segments, msh };
}

function getSegments(segments, name) {
  return segments.filter((s) => s.name === name);
}

function parsePid(segments) {
  const pid = getSegments(segments, 'PID')[0];
  if (!pid) return null;
  const idParts = splitComponents(pid.fields[2] || '');
  const nameParts = splitComponents(pid.fields[4] || '');
  return {
    patientId: idParts[0] || pid.fields[2] || '',
    lastName: nameParts[0] || '',
    firstName: nameParts[1] || '',
    dob: pid.fields[6] || '',
    gender: pid.fields[7] || ''
  };
}

function parseOrc(segments) {
  const orc = getSegments(segments, 'ORC')[0];
  if (!orc) return null;
  return {
    orderControl: orc.fields[0] || '',
    placerOrderNumber: orc.fields[1] || '',
    fillerOrderNumber: orc.fields[2] || '',
    orderStatus: orc.fields[4] || ''
  };
}

function parseObr(segments) {
  return getSegments(segments, 'OBR').map((obr) => ({
    setId: obr.fields[0] || '',
    placerOrderNumber: obr.fields[1] || '',
    fillerOrderNumber: obr.fields[2] || '',
    universalServiceId: obr.fields[3] || '',
    observationDateTime: obr.fields[6] || '',
    resultStatus: obr.fields[24] || ''
  }));
}

function parseObx(segments) {
  return getSegments(segments, 'OBX').map((obx) => ({
    setId: obx.fields[0] || '',
    valueType: obx.fields[1] || '',
    observationId: obx.fields[2] || '',
    observationSubId: obx.fields[3] || '',
    value: obx.fields[4] || '',
    units: obx.fields[5] || '',
    referenceRange: obx.fields[6] || '',
    abnormalFlags: obx.fields[7] || '',
    resultStatus: obx.fields[10] || '',
    observationDateTime: obx.fields[13] || ''
  }));
}

function parseOruMessage(raw) {
  const { segments, msh } = parseMessage(raw);
  return {
    type: 'ORU^R01',
    msh,
    pid: parsePid(segments),
    orc: parseOrc(segments),
    obr: parseObr(segments),
    obx: parseObx(segments),
    segments
  };
}

function parseOrmMessage(raw) {
  const { segments, msh } = parseMessage(raw);
  return {
    type: 'ORM^O01',
    msh,
    pid: parsePid(segments),
    orc: parseOrc(segments),
    obr: parseObr(segments),
    segments
  };
}

function parseAckMessage(raw) {
  const { segments, msh } = parseMessage(raw);
  const msa = getSegments(segments, 'MSA')[0];
  return {
    type: 'ACK',
    msh,
    ackCode: msa ? msa.fields[0] : '',
    messageControlId: msa ? msa.fields[1] : '',
    textMessage: msa ? msa.fields[2] : ''
  };
}

module.exports = {
  parseMessage,
  parsePid,
  parseOrc,
  parseObr,
  parseObx,
  parseOruMessage,
  parseOrmMessage,
  parseAckMessage,
  getSegments
};
