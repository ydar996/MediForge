'use strict';

/** HL7 v2.5 field/segment encoding helpers */
const FIELD_SEP = '|';
const COMPONENT_SEP = '^';
const REPEAT_SEP = '~';
const ESCAPE_SEP = '\\';
const SUBCOMPONENT_SEP = '&';

function escapeHl7(value) {
  if (value == null || value === '') return '';
  return String(value)
    .replace(/\\/g, '\\E\\')
    .replace(/\|/g, '\\F\\')
    .replace(/\^/g, '\\S\\')
    .replace(/~/g, '\\R\\')
    .replace(/&/g, '\\T\\');
}

function unescapeHl7(value) {
  if (!value) return '';
  return String(value)
    .replace(/\\F\\/g, '|')
    .replace(/\\S\\/g, '^')
    .replace(/\\R\\/g, '~')
    .replace(/\\T\\/g, '&')
    .replace(/\\E\\/g, '\\');
}

function joinComponents(parts) {
  return parts.map((p) => escapeHl7(p ?? '')).join(COMPONENT_SEP);
}

function splitComponents(field) {
  if (!field) return [];
  return field.split(COMPONENT_SEP).map(unescapeHl7);
}

function formatTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

module.exports = {
  FIELD_SEP,
  COMPONENT_SEP,
  REPEAT_SEP,
  ESCAPE_SEP,
  SUBCOMPONENT_SEP,
  escapeHl7,
  unescapeHl7,
  joinComponents,
  splitComponents,
  formatTimestamp
};
