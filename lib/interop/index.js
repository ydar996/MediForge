'use strict';

const hl7 = {
  encoding: require('./hl7/encoding'),
  parser: require('./hl7/parser'),
  generator: require('./hl7/generator'),
  ack: require('./hl7/ack'),
  mllp: require('./hl7/mllp')
};

const fhir = {
  resources: require('./fhir/resources'),
  client: require('./fhir/client')
};

const dicom = {
  dicomweb: require('./dicom/dicomweb-client')
};

const terminology = {
  loinc: require('./terminology/loinc-pclocd'),
  ccdd: require('./terminology/ccdd'),
  snomed: require('./terminology/snomed')
};

const adapters = {
  lab: require('./adapters/lab-adapter'),
  imaging: require('./adapters/imaging-adapter'),
  rx: require('./adapters/rx-adapter')
};

const config = require('./config');
const patientMatching = require('./patient-matching');

module.exports = {
  hl7,
  fhir,
  dicom,
  terminology,
  adapters,
  config,
  patientMatching
};
