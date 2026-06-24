'use strict';

/**
 * Unified IntegrationService: production-ready configurable layer for Canadian
 * labs (OLIS-style), imaging (DIR/PACS), e-prescribing (Infoway), and payers.
 *
 * Connects to provincial hubs, not individual labs/pharmacies. Enable per clinic
 * by setting config/integrations.json defaultProvince and enabled:true after onboarding.
 */
const interop = require('../interop');
const { assertOlisConsent } = require('../interop/olis-consent');
const { assertErxConsent } = require('../interop/prescribeit-consent');
const billing = require('../billing');
const { loadIntegrationsConfig } = require('./config-loader');
const messageRouter = require('./message-router');
const { withRetry } = require('./retry');
const { logAudit } = require('./audit-logger');

class IntegrationService {
  constructor(options = {}) {
    this.options = options;
    this.supabase = options.supabase || null;
    this.config = options.config || loadIntegrationsConfig({ province: options.province });
  }

  reloadConfig(province) {
    this.config = loadIntegrationsConfig({ province, reload: true });
    return this.config;
  }

  _olisConsentBlock(olisConsentGranted) {
    const requireConsent = this.config.security?.requireConsent !== false;
    if (!requireConsent) return null;
    if (olisConsentGranted === true) return null;
    const denied = assertOlisConsent([], { requireConsent: true });
    return {
      queued: true,
      blocked: true,
      code: denied.code,
      message: denied.message
    };
  }

  _erxConsentBlock(erxConsentGranted) {
    const requireConsent = this.config.security?.requireConsent !== false;
    if (!requireConsent) return null;
    if (erxConsentGranted === true) return null;
    const denied = assertErxConsent([], { requireConsent: true });
    return {
      queued: true,
      blocked: true,
      code: denied.code,
      message: denied.message
    };
  }

  async _transmitMedicationPayload({ payload, organizationId, userId, patient, correlationId, messageType }) {
    const cfg = this.config;
    const execute = async () => {
      const rxUrl = cfg.fhir?.rxEndpoint || cfg.rx?.pharmacyEndpoint || payload.routing?.destination || cfg.fhir?.baseUrl;
      if (cfg.enabled && rxUrl) {
        const result = await interop.fhir.client.createMedicationRequest({
          baseUrl: rxUrl,
          oauth: this._oauth(cfg),
          resource: payload.resource
        });
        return { payload, result, queued: false, messageType };
      }
      return { payload, queued: true, simulated: true, messageType };
    };

    const result = await withRetry(execute, { maxRetries: cfg.security?.maxRetries ?? 3 });

    await logAudit(this.supabase, {
      organizationId,
      direction: 'outbound',
      standard: 'fhir',
      messageType: messageType || 'sendPrescription',
      correlationId,
      patientId: patient?.id,
      status: result.queued ? 'pending' : 'sent',
      payload: result,
      userId,
      province: cfg.province,
      transport: 'fhir'
    });

    return result;
  }

  getStatus() {
    const cfg = this.config;
    return {
      enabled: cfg.enabled === true,
      province: cfg.province,
      adapters: cfg.adapters,
      transports: {
        lab: messageRouter.resolveTransport('lab', cfg),
        imaging: messageRouter.resolveTransport('imaging', cfg),
        rx: messageRouter.resolveTransport('rx', cfg),
        claims: messageRouter.resolveTransport('claims', cfg)
      },
      connectivity: {
        hl7Mllp: Boolean(cfg.hl7?.mllp?.host),
        fhir: Boolean(cfg.fhir?.baseUrl),
        dicomweb: Boolean(cfg.dicomweb?.wadoRsRoot),
        rxEndpoint: Boolean(cfg.fhir?.rxEndpoint || cfg.rx?.pharmacyEndpoint),
        claimsPortal: Boolean(cfg.billing?.claimPortalUrl)
      }
    };
  }

  /**
   * Send lab or imaging order to provincial hub (HL7 ORM/OML or FHIR ServiceRequest).
   */
  async sendOrder({ type, patient, order, organizationId, userId, olisConsentGranted }) {
    if (!patient || !order) throw new Error('patient and order required');
    const domain = type === 'imaging' ? 'imaging' : 'lab';
    if (domain === 'lab') {
      const consentBlock = this._olisConsentBlock(olisConsentGranted);
      if (consentBlock) return consentBlock;
    }
    const cfg = this.config;
    const transport = messageRouter.resolveTransport(domain, cfg);
    const correlationId = order.serial_number || order.serialNumber || order.id;

    const execute = async () => {
      if (domain === 'lab') {
        if (transport === 'fhir') {
          const resource = interop.adapters.lab.orderToFhirServiceRequest({ patient, order, config: cfg });
          if (cfg.enabled && cfg.fhir?.baseUrl) {
            const result = await interop.fhir.client.createServiceRequest({
              baseUrl: cfg.fhir.baseUrl,
              oauth: this._oauth(cfg),
              resource
            });
            return { transport: 'fhir', resource, result, queued: false };
          }
          return { transport: 'fhir', resource, queued: true };
        }

        const hl7 = interop.adapters.lab.orderToHl7({ patient, order, config: cfg });
        const mllp = cfg.hl7?.mllp;
        if (cfg.enabled && mllp?.host) {
          const { ack } = await interop.hl7.mllp.sendMllp({
            host: mllp.host,
            port: mllp.port || 2575,
            message: hl7,
            useTls: mllp.useTls !== false
          });
          return {
            transport: 'hl7',
            hl7,
            ack,
            ackParsed: interop.hl7.parser.parseAckMessage(ack),
            queued: false
          };
        }
        return { transport: 'hl7', hl7, queued: true };
      }

      // imaging
      if (transport === 'hl7') {
        const hl7 = interop.adapters.imaging.orderToHl7({ patient, order, config: cfg });
        return { transport: 'hl7', hl7, queued: !cfg.enabled };
      }
      const resource = interop.adapters.imaging.orderToFhirServiceRequest({ patient, order, config: cfg });
      if (cfg.enabled && cfg.fhir?.baseUrl) {
        const result = await interop.fhir.client.createServiceRequest({
          baseUrl: cfg.fhir.baseUrl,
          oauth: this._oauth(cfg),
          resource
        });
        return { transport: 'fhir', resource, result, queued: false };
      }
      return { transport: 'fhir', resource, queued: true };
    };

    const maxRetries = cfg.security?.maxRetries ?? 3;
    let result;
    try {
      result = await withRetry(execute, { maxRetries });
    } catch (err) {
      await logAudit(this.supabase, {
        organizationId,
        direction: 'outbound',
        standard: transport === 'hl7' ? 'hl7' : 'fhir',
        messageType: `sendOrder_${domain}`,
        correlationId,
        patientId: patient.id,
        status: 'failed',
        error: err.message,
        userId,
        province: cfg.province,
        transport
      });
      throw err;
    }

    await logAudit(this.supabase, {
      organizationId,
      direction: 'outbound',
      standard: result.transport === 'hl7' ? 'hl7' : 'fhir',
      messageType: `sendOrder_${domain}`,
      correlationId,
      patientId: patient.id,
      status: result.queued ? 'pending' : 'sent',
      payload: result,
      userId,
      province: cfg.province,
      transport: result.transport
    });

    return result;
  }

  /**
   * Receive lab/imaging results: HL7 ORU^R01 or FHIR DiagnosticReport bundle.
   */
  async receiveResult({ rawHl7, fhirBundle, organizationId, userId, orderId, olisConsentGranted }) {
    const consentBlock = this._olisConsentBlock(olisConsentGranted);
    if (consentBlock) return consentBlock;
    const route = messageRouter.routeInboundResult({ rawHl7, fhirBundle });
    let chart;
    let ack;

    if (route.standard === 'hl7') {
      const parsed = interop.adapters.lab.parseOruMessage(rawHl7);
      chart = interop.adapters.lab.oruToChartResults(parsed);
      ack = interop.hl7.ack.generateAck({ inboundMsh: parsed.msh, ackCode: 'AA' });
    } else {
      chart = interop.adapters.lab.fhirDiagnosticReportToChartResults(fhirBundle);
    }

    await logAudit(this.supabase, {
      organizationId,
      direction: 'inbound',
      standard: route.standard,
      messageType: 'receiveResult',
      correlationId: chart.placerOrderNumber || orderId,
      status: 'received',
      payload: { critical: chart.critical, resultCount: Object.keys(chart.results || {}).length },
      userId,
      province: this.config.province,
      transport: route.standard
    });

    return { chart, ack, standard: route.standard };
  }

  /**
   * Ingest imaging report (HL7 ORU or FHIR DiagnosticReport) for DIR-ready desk.
   */
  async ingestImagingReport({ rawHl7, fhirBundle, organizationId, userId }) {
    const route = messageRouter.routeInboundResult({ rawHl7, fhirBundle });
    let chart;
    let ack;
    if (route.standard === 'hl7') {
      const parsed = interop.adapters.lab.parseOruMessage(rawHl7);
      chart = interop.adapters.lab.oruToChartResults(parsed);
      chart.standard = 'hl7_oru_imaging';
      ack = interop.hl7.ack.generateAck({ inboundMsh: parsed.msh, ackCode: 'AA' });
    } else {
      chart = interop.adapters.lab.fhirDiagnosticReportToChartResults(fhirBundle);
      chart.standard = 'fhir_diagnostic_report_imaging';
    }
    await logAudit(this.supabase, {
      organizationId,
      direction: 'inbound',
      standard: route.standard,
      messageType: 'ingestImagingReport',
      correlationId: chart.placerOrderNumber,
      status: 'received',
      payload: { resultCount: Object.keys(chart.results || {}).length },
      userId,
      province: this.config.province,
      transport: route.standard
    });
    return { chart, ack, standard: route.standard };
  }

  generateImagingHl7({ patient, order }) {
    return {
      hl7: interop.adapters.imaging.orderToHl7({ patient, order, config: this.config })
    };
  }

  generateImagingFhir({ patient, order }) {
    return {
      resource: interop.adapters.imaging.orderToFhirServiceRequest({ patient, order, config: this.config })
    };
  }

  connectingOntarioLaunch({ patient, purpose }) {
    const connectingOntario = require('../interop/connecting-ontario');
    const cfg = { ...this.config, connectingOntario: this.config.connectingOntario || {} };
    return connectingOntario.buildConnectingOntarioLaunchUrl({ patient, config: cfg, purpose });
  }

  smartLaunch({ patient, scope, launch }) {
    const smartLaunch = require('../interop/smart-launch');
    return smartLaunch.buildSmartLaunchUrl({ patient, config: this.config, scope, launch });
  }

  attachDicomStudyToOrderResults(existingResults, dicomMeta) {
    return interop.adapters.imaging.attachDicomStudyToResults(existingResults, dicomMeta);
  }

  /**
   * Send electronic prescription via Infoway national ePrescribing (FHIR MedicationRequest).
   */
  async sendPrescription({ patient, prescription, organizationId, userId, erxConsentGranted, pharmacy }) {
    if (!patient || !prescription) throw new Error('patient and prescription required');
    const consentBlock = this._erxConsentBlock(erxConsentGranted);
    if (consentBlock) return consentBlock;

    const cfg = this.config;
    let payload = interop.adapters.rx.prescriptionToInfowayPayload({ patient, prescription, config: cfg });
    payload = interop.adapters.rx.attachPharmacyDestination(payload, pharmacy);
    const correlationId = prescription.prescription_number || prescription.id;
    return this._transmitMedicationPayload({
      payload,
      organizationId,
      userId,
      patient,
      correlationId,
      messageType: 'sendPrescription'
    });
  }

  /**
   * Cancel a transmitted or queued e-prescription (MedicationRequest status cancelled).
   */
  async cancelPrescription({ patient, prescription, organizationId, userId, erxConsentGranted, reason }) {
    if (!patient || !prescription) throw new Error('patient and prescription required');
    const consentBlock = this._erxConsentBlock(erxConsentGranted);
    if (consentBlock) return consentBlock;

    const payload = interop.adapters.rx.prescriptionToCancelledPayload({
      patient,
      prescription,
      config: this.config,
      reason
    });
    const correlationId = prescription.prescription_number || prescription.id;
    const result = await this._transmitMedicationPayload({
      payload,
      organizationId,
      userId,
      patient,
      correlationId,
      messageType: 'cancelPrescription'
    });
    return { ...result, cancelled: true };
  }

  /**
   * Request prescription renewal via FHIR MedicationRequest with basedOn prior Rx.
   */
  async requestPrescriptionRenewal({ patient, prescription, organizationId, userId, erxConsentGranted, requestedBy }) {
    if (!patient || !prescription) throw new Error('patient and prescription required');
    const consentBlock = this._erxConsentBlock(erxConsentGranted);
    if (consentBlock) return consentBlock;

    const payload = interop.adapters.rx.prescriptionToRenewalPayload({
      patient,
      prescription,
      config: this.config,
      requestedBy
    });
    const correlationId = `${prescription.prescription_number || prescription.id}-renewal`;
    const result = await this._transmitMedicationPayload({
      payload,
      organizationId,
      userId,
      patient,
      correlationId,
      messageType: 'requestPrescriptionRenewal'
    });
    return { ...result, renewalRequested: true };
  }

  /**
   * Parse MedicationDispense feedback from pharmacy network (queue mode or live).
   */
  async ingestMedicationDispense({ fhirBundle, organizationId, userId }) {
    const feedback = interop.adapters.rx.parseMedicationDispenseFeedback(fhirBundle);
    await logAudit(this.supabase, {
      organizationId,
      direction: 'inbound',
      standard: 'fhir',
      messageType: 'ingestMedicationDispense',
      correlationId: feedback.prescriptionRef || 'unknown',
      status: feedback.parsed ? 'received' : 'error',
      payload: feedback,
      userId,
      province: this.config.province,
      transport: 'fhir'
    });
    return feedback;
  }

  /**
   * Preview FHIR MedicationRequest payload without transmit.
   */
  generateRxFhir({ patient, prescription, pharmacy }) {
    return interop.adapters.rx.generateRxFhirPreview({
      patient,
      prescription,
      config: this.config,
      pharmacy
    });
  }

  /**
   * Simulate eRx transmit when Infoway endpoint is not configured.
   */
  async simulateRxTransmit({ patient, prescription, organizationId, userId, erxConsentGranted, pharmacy }) {
    const consentBlock = this._erxConsentBlock(erxConsentGranted);
    if (consentBlock) return consentBlock;

    const payload = interop.adapters.rx.generateRxFhirPreview({
      patient,
      prescription,
      config: this.config,
      pharmacy
    });
    const correlationId = prescription.prescription_number || prescription.id;
    await logAudit(this.supabase, {
      organizationId,
      direction: 'outbound',
      standard: 'fhir',
      messageType: 'simulateRxTransmit',
      correlationId,
      patientId: patient?.id,
      status: 'pending',
      payload: { payload, simulated: true },
      userId,
      province: this.config.province,
      transport: 'fhir'
    });
    return {
      payload,
      queued: true,
      simulated: true,
      ack: { status: 'accepted', mode: 'simulate' }
    };
  }

  /**
   * Submit provincial or private insurance claim (OHIP MCEDT-style, MSP Teleplan, etc.).
   */
  async submitClaim({ patient, provider, invoice, services, payerCode, organizationId, userId, mcedtConfig }) {
    const cfg = this.config;
    const billingCfg = billing.config.loadBillingConfig();
    const draft = billing.claims.buildProvincialClaimDraft({
      patient,
      provider,
      invoice,
      services,
      payerCode,
      config: billingCfg
    });

    const portalUrl = cfg.billing?.claimPortalUrl || cfg.provinceMeta?.hubs?.billing?.endpoint;
    const transport = draft.transport || messageRouter.resolveTransport('claims', cfg);
    const client = billing.createMcedtClientFromConfig({
      enabled: cfg.enabled,
      billing: {
        claimPortalUrl: portalUrl,
        claimTransport: transport,
        billingNumber: provider?.billingNumber,
        mcedt: mcedtConfig || cfg.billing?.mcedt || {}
      }
    });

    const batch = billing.mcedtFormat.buildMcedtBatch({
      claims: [billing.mcedtFormat.normalizeClaim(draft)],
      submitter: {
        billingNumber: provider?.billingNumber,
        organizationId
      },
      payerCode: payerCode || draft.payerCode
    });

    const execute = async () => client.submitBatch(batch);

    const result = await withRetry(execute, { maxRetries: cfg.security?.maxRetries ?? 3 });

    await logAudit(this.supabase, {
      organizationId,
      direction: 'outbound',
      standard: 'billing',
      messageType: 'submitClaim',
      correlationId: invoice?.invoiceNumber || invoice?.id,
      patientId: patient?.id,
      status: result.submitted ? 'sent' : 'pending',
      payload: { payerCode, transport, queued: result.queued },
      userId,
      province: cfg.province,
      transport
    });

    return { ...result, draft, transport };
  }

  async batchSubmitClaims({ claimRecords, submitter, organizationId, userId }) {
    const cfg = this.config;
    const client = billing.createMcedtClientFromConfig({
      enabled: cfg.enabled,
      billing: {
        claimPortalUrl: cfg.billing?.claimPortalUrl,
        mcedt: cfg.billing?.mcedt || submitter || {}
      }
    });
    const batch = billing.claimsWorkflow.buildBatchFromClaimRecords(claimRecords, submitter);
    const result = await client.submitBatch(batch);

    await logAudit(this.supabase, {
      organizationId,
      direction: 'outbound',
      standard: 'billing',
      messageType: 'batchSubmitClaims',
      correlationId: batch.claims?.[0]?.claimReference,
      status: result.submitted ? 'sent' : 'pending',
      payload: { claimCount: batch.claims?.length, queued: result.queued },
      userId,
      province: cfg.province,
      transport: 'MCEDT'
    });

    return { ...result, batch };
  }

  async checkOhipEligibility({ patient, organizationId, userId }) {
    const cfg = this.config;
    const client = billing.createMcedtClientFromConfig({
      enabled: cfg.enabled,
      billing: { claimPortalUrl: cfg.billing?.claimPortalUrl, mcedt: cfg.billing?.mcedt || {} }
    });
    const result = await client.checkEligibility({
      phn: patient?.phn || patient?.healthCardNumber,
      versionCode: patient?.healthCardVersion || patient?.versionCode,
      dob: patient?.dob
    });

    await logAudit(this.supabase, {
      organizationId,
      direction: 'outbound',
      standard: 'billing',
      messageType: 'checkOhipEligibility',
      patientId: patient?.id,
      status: result.checked ? 'processed' : 'pending',
      payload: { formatValid: result.formatValid, queued: result.queued },
      userId,
      province: cfg.province,
      transport: 'MCEDT'
    });

    return result;
  }

  async downloadMcedtRemittance({ remittanceDate, organizationId, userId }) {
    const cfg = this.config;
    const client = billing.createMcedtClientFromConfig({
      enabled: cfg.enabled,
      billing: { claimPortalUrl: cfg.billing?.claimPortalUrl, mcedt: cfg.billing?.mcedt || {} }
    });
    const result = await client.downloadRemittance({ remittanceDate });

    await logAudit(this.supabase, {
      organizationId,
      direction: 'inbound',
      standard: 'billing',
      messageType: 'downloadMcedtRemittance',
      status: result.downloaded ? 'received' : 'pending',
      payload: { queued: result.queued },
      userId,
      province: cfg.province,
      transport: 'MCEDT'
    });

    return result;
  }

  exportMcedtXml({ batch }) {
    const validation = billing.mcedtFormat.validateClaimBatch(batch);
    const xml = billing.mcedtFormat.serializeBatchToXml(batch);
    return { validation, xml };
  }

  /**
   * Process remittance advice (ERA) and reconcile with open invoices.
   */
  async processRemittance({ raw, invoices, organizationId, userId }) {
    const remittance = billing.remittance.parseRemittanceAdvice(raw);
    if (!remittance.parsed) throw new Error(remittance.error || 'Invalid remittance');

    const reconciliation = billing.remittance.reconcileRemittanceWithInvoices(remittance, invoices);

    await logAudit(this.supabase, {
      organizationId,
      direction: 'inbound',
      standard: 'billing',
      messageType: 'processRemittance',
      correlationId: remittance.payerId,
      status: 'received',
      payload: {
        totalPaid: remittance.totalPaid,
        paymentCount: remittance.payments?.length,
        matched: reconciliation.filter((r) => r.matched).length
      },
      userId,
      province: this.config.province,
      transport: remittance.format
    });

    return { remittance, reconciliation };
  }

  /**
   * DICOMweb / legacy DIMSE proxy for imaging retrieval.
   */
  async dicomweb({ operation, params }) {
    const cfg = this.config;
    const token = process.env.INTEROP_DICOM_TOKEN || cfg.dicomweb?.bearerToken;
    const root = cfg.dicomweb?.wadoRsRoot || cfg.dicomweb?.qidoRsRoot;
    if (!root) throw new Error('dicomweb root not configured');

    switch (operation) {
      case 'qidoStudies':
        return interop.dicom.dicomweb.qidoSearchStudies({ wadoRsRoot: root, ...params, token });
      case 'wadoInstance':
        return interop.dicom.dicomweb.wadoRetrieveInstance({ wadoRsRoot: root, ...params, token });
      case 'stow':
        return interop.dicom.dicomweb.stowStore({
          stowRsRoot: cfg.dicomweb.stowRsRoot || root,
          dicomBuffer: Buffer.from(params.base64, 'base64'),
          token
        });
      case 'cFind':
        return interop.dicom.dicomweb.cFindViaGateway({
          gatewayUrl: cfg.dicomweb.dimseGatewayUrl,
          query: params.query,
          token
        });
      case 'cMove':
        return interop.dicom.dicomweb.cMoveViaGateway({
          gatewayUrl: cfg.dicomweb.dimseGatewayUrl,
          studyInstanceUid: params.studyInstanceUid,
          destinationAe: params.destinationAe,
          token
        });
      default:
        throw new Error(`Unknown DICOMweb operation: ${operation}`);
    }
  }

  matchPatient(params) {
    return interop.patientMatching.matchPatient(params);
  }

  _oauth(cfg) {
    return {
      ...cfg.fhir.oauth,
      clientId: process.env.INTEROP_FHIR_CLIENT_ID || cfg.fhir.oauth.clientId,
      clientSecret: process.env.INTEROP_FHIR_CLIENT_SECRET || cfg.fhir.oauth.clientSecret
    };
  }
}

module.exports = { IntegrationService };
