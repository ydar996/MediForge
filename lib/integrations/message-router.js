'use strict';

/**
 * Routes outbound clinical messages to HL7 v2 or FHIR R4 based on province config.
 * Canadian reality: most provincial lab hubs accept HL7 ORM/ORU; Infoway national
 * services increasingly use FHIR. Clinics configure per-domain transport in adapters.
 */

const DOMAIN_KEYS = {
  lab: 'lab',
  imaging: 'imaging',
  rx: 'rx',
  claims: 'claims'
};

function resolveTransport(domain, config) {
  const key = DOMAIN_KEYS[domain] || domain;
  const adapters = config?.adapters || {};
  const explicit = adapters[key];
  if (explicit === 'hl7' || explicit === 'fhir') return explicit;

  const provinceTransport = config?.provinceMeta?.hubs?.[key]?.transport;
  if (provinceTransport === 'hl7' || provinceTransport === 'fhir') return provinceTransport;

  const defaults = { lab: 'hl7', imaging: 'fhir', rx: 'fhir', claims: 'webservice' };
  return defaults[key] || 'fhir';
}

function resolveLabMessageType(config) {
  return config?.adapters?.labMessageType || 'ORM^O01';
}

function routeOutbound({ domain, config, hl7Payload, fhirPayload }) {
  const transport = resolveTransport(domain, config);
  if (transport === 'hl7') {
    return { transport, standard: 'hl7', payload: hl7Payload, messageType: resolveLabMessageType(config) };
  }
  return { transport, standard: 'fhir', payload: fhirPayload };
}

function routeInboundResult({ rawHl7, fhirBundle }) {
  if (rawHl7) return { standard: 'hl7', payload: rawHl7 };
  if (fhirBundle) return { standard: 'fhir', payload: fhirBundle };
  throw new Error('receiveResult requires rawHl7 or fhirBundle');
}

module.exports = {
  resolveTransport,
  resolveLabMessageType,
  routeOutbound,
  routeInboundResult
};
