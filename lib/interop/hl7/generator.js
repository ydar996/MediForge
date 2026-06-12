'use strict';

const { escapeHl7, joinComponents, formatTimestamp } = require('./encoding');

function buildMsh({
  sendingApplication = 'MEDIFORGE',
  sendingFacility = 'CLINIC',
  receivingApplication = 'LIS',
  receivingFacility = 'LAB',
  messageType,
  messageControlId,
  processingId = 'P',
  version = '2.5'
}) {
  const ts = formatTimestamp();
  const msgId = messageControlId || `MF${Date.now()}`;
  return (
    `MSH|^~\\&|${escapeHl7(sendingApplication)}|${escapeHl7(sendingFacility)}|` +
    `${escapeHl7(receivingApplication)}|${escapeHl7(receivingFacility)}|` +
    `${ts}||${messageType}|${escapeHl7(msgId)}|${processingId}|${version}`
  );
}

function buildPid(patient) {
  const name = joinComponents([
    patient.lastName || '',
    patient.firstName || '',
    patient.middleName || ''
  ]);
  const patientId = patient.phn || patient.patientId || patient.id || '';
  const idType = patient.phn ? 'JHN' : 'MR';
  return (
    `PID|1||${escapeHl7(patientId)}^${idType}||${name}||` +
    `${escapeHl7(patient.dob || '')}|${escapeHl7(patient.gender || '')}`
  );
}

function buildOrc({ orderControl = 'NW', placerOrderNumber, fillerOrderNumber = '' }) {
  return `ORC|${orderControl}|${escapeHl7(placerOrderNumber)}|${escapeHl7(fillerOrderNumber)}`;
}

function buildObr({
  setId = 1,
  placerOrderNumber,
  fillerOrderNumber = '',
  universalServiceId,
  observationDateTime
}) {
  const ts = observationDateTime || formatTimestamp();
  return (
    `OBR|${setId}|${escapeHl7(placerOrderNumber)}|${escapeHl7(fillerOrderNumber)}|` +
    `${escapeHl7(universalServiceId)}||${ts}`
  );
}

/**
 * Generate ORM^O01 lab or imaging order (HL7 v2.5)
 */
function generateOrmO01({ patient, order, config = {} }) {
  const msgType = order.messageType || 'ORM^O01';
  const msh = buildMsh({
    sendingApplication: config.sendingApplication,
    sendingFacility: config.sendingFacility,
    receivingApplication: config.receivingApplication || 'LIS',
    receivingFacility: config.receivingFacility || 'OLIS',
    messageType: msgType,
    messageControlId: order.messageControlId || order.placerOrderNumber
  });

  const pid = buildPid(patient);
  const orc = buildOrc({
    orderControl: order.orderControl || 'NW',
    placerOrderNumber: order.placerOrderNumber,
    fillerOrderNumber: order.fillerOrderNumber
  });

  const obrLines = (order.items || []).map((item, idx) =>
    buildObr({
      setId: idx + 1,
      placerOrderNumber: order.placerOrderNumber,
      fillerOrderNumber: item.fillerOrderNumber || '',
      universalServiceId: item.universalServiceId || `${item.loinc || item.cpt || item.name}^${item.name}^LN`,
      observationDateTime: order.orderDateTime
    })
  );

  return [msh, pid, orc, ...obrLines].join('\r');
}

/**
 * Generate OML^O21 (lab order message - observation request)
 */
function generateOmlO21(params) {
  return generateOrmO01({ ...params, order: { ...params.order, messageType: 'OML^O21' } });
}

/**
 * Generate ORU^R01 result message
 */
function generateOruR01({ patient, result, config = {} }) {
  const msh = buildMsh({
    sendingApplication: config.sendingApplication || 'LIS',
    sendingFacility: config.receivingFacility || 'OLIS',
    receivingApplication: config.sendingApplication || 'MEDIFORGE',
    receivingFacility: config.sendingFacility || 'CLINIC',
    messageType: 'ORU^R01',
    messageControlId: result.messageControlId || result.placerOrderNumber
  });

  const pid = buildPid(patient);
  const orc = buildOrc({
    orderControl: 'RE',
    placerOrderNumber: result.placerOrderNumber,
    fillerOrderNumber: result.fillerOrderNumber
  });

  const lines = [msh, pid, orc];
  (result.observations || []).forEach((obs, idx) => {
    lines.push(
      buildObr({
        setId: idx + 1,
        placerOrderNumber: result.placerOrderNumber,
        fillerOrderNumber: result.fillerOrderNumber,
        universalServiceId: obs.universalServiceId || `${obs.loinc}^${obs.name}^LN`,
        observationDateTime: obs.observationDateTime || result.resultDateTime
      })
    );
    lines.push(
      `OBX|1|${escapeHl7(obs.valueType || 'NM')}|${escapeHl7(obs.universalServiceId || obs.loinc)}||` +
        `${escapeHl7(obs.value)}|${escapeHl7(obs.units || '')}|${escapeHl7(obs.referenceRange || '')}|` +
        `${escapeHl7(obs.abnormalFlags || '')}|||${escapeHl7(obs.resultStatus || 'F')}`
    );
  });

  return lines.join('\r');
}

module.exports = {
  buildMsh,
  buildPid,
  buildOrc,
  buildObr,
  generateOrmO01,
  generateOmlO21,
  generateOruR01
};
