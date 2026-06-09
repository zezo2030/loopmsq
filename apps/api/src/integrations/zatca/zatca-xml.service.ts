import { Injectable } from '@nestjs/common';
import { ZatcaSellerConfig } from '../../config/zatca.config';
import {
  BuildInvoiceInput,
  InvoiceDocumentType,
  InvoiceLineInput,
  InvoiceTransactionType,
} from './zatca.types';

interface LineComputed extends InvoiceLineInput {
  lineNet: number; // qty*price - discount
  lineVat: number;
  lineTotalInclVat: number;
}

export interface InvoiceTotals {
  lineExtension: number; // sum of line nets
  taxExclusive: number;
  taxInclusive: number;
  vatTotal: number;
  allowanceTotal: number;
  payable: number;
}

/**
 * Builds a ZATCA-compliant UBL 2.1 invoice XML (unsigned).
 * The signature (UBLExtensions) and the QR (AdditionalDocumentReference) are
 * injected later by the ZATCA SDK during signing.
 *
 * Document subtype `name` attribute (KSA-2): 7 digits
 *   pos1 PIH present, pos2 Self-billing, pos3 3rd party, pos4 Nominal,
 *   pos5 Export, pos6 Summary, pos7 Self-billed reference.
 * `InvoiceTypeCode` text: 388 invoice, 383 debit note, 381 credit note.
 * Transaction code (first 2 of name? no) — we use the standard scheme:
 *   "0100000" standard, "0200000" simplified.
 */
@Injectable()
export class ZatcaXmlService {
  buildTotals(lines: InvoiceLineInput[]): InvoiceTotals {
    let lineExtension = 0;
    let vatTotal = 0;
    let allowanceTotal = 0;
    for (const l of lines) {
      const gross = round2(l.quantity * l.unitPrice);
      const discount = round2(l.discount || 0);
      const net = round2(gross - discount);
      const vat = round2((net * (l.vatRate || 0)) / 100);
      lineExtension = round2(lineExtension + net);
      vatTotal = round2(vatTotal + vat);
      allowanceTotal = round2(allowanceTotal + discount);
    }
    const taxExclusive = lineExtension;
    const taxInclusive = round2(taxExclusive + vatTotal);
    return {
      lineExtension,
      taxExclusive,
      taxInclusive,
      vatTotal,
      allowanceTotal,
      payable: taxInclusive,
    };
  }

  build(input: BuildInvoiceInput, seller: ZatcaSellerConfig): string {
    const currency = input.currency || 'SAR';
    const lines = input.lines.map((l) => this.computeLine(l));
    const totals = this.buildTotals(input.lines);
    const typeCode = this.invoiceTypeCode(input.documentType);
    const nameAttr = this.invoiceSubtype(input.transactionType, input.pih);
    const issue = input.issuedAt;
    const issueDate = issue.toISOString().slice(0, 10);
    // ZATCA cbc:IssueTime is HH:MM:SS with no timezone suffix (the SDK parses
    // IssueDate + ' ' + IssueTime and rejects a trailing 'Z').
    const issueTime = issue.toISOString().slice(11, 19);

    // VAT category grouping for TaxSubtotal
    const taxSubtotals = this.groupTaxCategories(input.lines);

    return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${esc(input.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${esc(input.uuid)}</cbc:UUID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${nameAttr}">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${currency}</cbc:TaxCurrencyCode>
${this.billingReference(input)}  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${input.icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${esc(
        input.pih,
      )}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
${this.supplierParty(seller)}
${this.customerParty(input)}
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${issueDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>10</cbc:PaymentMeansCode>
${this.noteReason(input)}  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${fmt(totals.vatTotal)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${currency}">${fmt(totals.vatTotal)}</cbc:TaxAmount>
${taxSubtotals
  .map(
    (s) => `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${currency}">${fmt(s.taxable)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${currency}">${fmt(s.tax)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${s.category}</cbc:ID>
        <cbc:Percent>${fmt(s.rate)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`,
  )
  .join('\n')}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${currency}">${fmt(
      totals.lineExtension,
    )}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${currency}">${fmt(
      totals.taxExclusive,
    )}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${currency}">${fmt(
      totals.taxInclusive,
    )}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${currency}">${fmt(
      totals.allowanceTotal,
    )}</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount currencyID="${currency}">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${currency}">${fmt(
      totals.payable,
    )}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lines.map((l, i) => this.invoiceLine(l, i + 1, currency)).join('\n')}
</Invoice>`;
  }

  private computeLine(l: InvoiceLineInput): LineComputed {
    const gross = round2(l.quantity * l.unitPrice);
    const discount = round2(l.discount || 0);
    const net = round2(gross - discount);
    const vat = round2((net * (l.vatRate || 0)) / 100);
    return {
      ...l,
      lineNet: net,
      lineVat: vat,
      lineTotalInclVat: round2(net + vat),
    };
  }

  private invoiceLine(l: LineComputed, n: number, currency: string): string {
    const cat = l.vatCategory || 'S';
    return `  <cac:InvoiceLine>
    <cbc:ID>${n}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${l.unitCode || 'PCE'}">${fmt(
      l.quantity,
    )}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${currency}">${fmt(
      l.lineNet,
    )}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${currency}">${fmt(l.lineVat)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="${currency}">${fmt(
        l.lineTotalInclVat,
      )}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${esc(l.name)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${cat}</cbc:ID>
        <cbc:Percent>${fmt(l.vatRate)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${currency}">${fmt(
        l.unitPrice,
      )}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  }

  private supplierParty(s: ZatcaSellerConfig): string {
    return `  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${esc(s.identityScheme)}">${esc(
          s.identityValue,
        )}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${esc(s.street)}</cbc:StreetName>
        <cbc:BuildingNumber>${esc(s.buildingNumber)}</cbc:BuildingNumber>
${s.plotIdentification ? `        <cbc:PlotIdentification>${esc(s.plotIdentification)}</cbc:PlotIdentification>\n` : ''}${s.citySubdivision ? `        <cbc:CitySubdivisionName>${esc(s.citySubdivision)}</cbc:CitySubdivisionName>\n` : ''}        <cbc:CityName>${esc(s.city)}</cbc:CityName>
        <cbc:PostalZone>${esc(s.postalZone)}</cbc:PostalZone>
${s.countrySubentity ? `        <cbc:CountrySubentity>${esc(s.countrySubentity)}</cbc:CountrySubentity>\n` : ''}        <cac:Country>
          <cbc:IdentificationCode>${esc(s.countryCode)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${esc(s.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(s.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;
  }

  private customerParty(input: BuildInvoiceInput): string {
    const c = input.customer;
    // Simplified (B2C) invoices may omit buyer details.
    if (
      input.transactionType === InvoiceTransactionType.SIMPLIFIED &&
      (!c || (!c.name && !c.vatNumber))
    ) {
      // Minimal B2C buyer: no PostalAddress — emitting country "SA" without a
      // 5-digit postal code trips BR-KSA-67. Name only is valid for simplified.
      return `  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(c?.name || 'Walk-in customer')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
    }
    return `  <cac:AccountingCustomerParty>
    <cac:Party>
${c?.identityValue ? `      <cac:PartyIdentification>\n        <cbc:ID schemeID="${esc(c.identityScheme || 'NAT')}">${esc(c.identityValue)}</cbc:ID>\n      </cac:PartyIdentification>\n` : ''}      <cac:PostalAddress>
${c?.street ? `        <cbc:StreetName>${esc(c.street)}</cbc:StreetName>\n` : ''}${c?.buildingNumber ? `        <cbc:BuildingNumber>${esc(c.buildingNumber)}</cbc:BuildingNumber>\n` : ''}${c?.plotIdentification ? `        <cbc:PlotIdentification>${esc(c.plotIdentification)}</cbc:PlotIdentification>\n` : ''}${c?.citySubdivision ? `        <cbc:CitySubdivisionName>${esc(c.citySubdivision)}</cbc:CitySubdivisionName>\n` : ''}${c?.city ? `        <cbc:CityName>${esc(c.city)}</cbc:CityName>\n` : ''}${c?.postalZone ? `        <cbc:PostalZone>${esc(c.postalZone)}</cbc:PostalZone>\n` : ''}${c?.countrySubentity ? `        <cbc:CountrySubentity>${esc(c.countrySubentity)}</cbc:CountrySubentity>\n` : ''}        <cac:Country>
          <cbc:IdentificationCode>${esc(c?.countryCode || 'SA')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
${c?.vatNumber ? `      <cac:PartyTaxScheme>\n        <cbc:CompanyID>${esc(c.vatNumber)}</cbc:CompanyID>\n        <cac:TaxScheme>\n          <cbc:ID>VAT</cbc:ID>\n        </cac:TaxScheme>\n      </cac:PartyTaxScheme>\n` : ''}      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${esc(c?.name || '')}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`;
  }

  private billingReference(input: BuildInvoiceInput): string {
    if (
      input.documentType === InvoiceDocumentType.INVOICE ||
      !input.originalInvoiceNumber
    ) {
      return '';
    }
    return `  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${esc(input.originalInvoiceNumber)}</cbc:ID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>
`;
  }

  private noteReason(input: BuildInvoiceInput): string {
    if (
      input.documentType === InvoiceDocumentType.INVOICE ||
      !input.noteReason
    ) {
      return '';
    }
    // KSA-10: credit/debit note reason goes in PaymentMeans/InstructionNote.
    return `    <cbc:InstructionNote>${esc(input.noteReason)}</cbc:InstructionNote>\n`;
  }

  /** name attribute on InvoiceTypeCode: 7-digit subtype string */
  private invoiceSubtype(t: InvoiceTransactionType, pih: string): string {
    // pos1 = 0 (PIH always referenced separately), simplified vs standard
    return t === InvoiceTransactionType.SIMPLIFIED ? '0200000' : '0100000';
  }

  private invoiceTypeCode(d: InvoiceDocumentType): string {
    switch (d) {
      case InvoiceDocumentType.CREDIT_NOTE:
        return '381';
      case InvoiceDocumentType.DEBIT_NOTE:
        return '383';
      default:
        return '388';
    }
  }

  private groupTaxCategories(
    lines: InvoiceLineInput[],
  ): { category: string; rate: number; taxable: number; tax: number }[] {
    const map = new Map<
      string,
      { category: string; rate: number; taxable: number; tax: number }
    >();
    for (const l of lines) {
      const cat = l.vatCategory || 'S';
      const rate = l.vatRate || 0;
      const key = `${cat}:${rate}`;
      const net = round2(l.quantity * l.unitPrice - (l.discount || 0));
      const vat = round2((net * rate) / 100);
      const cur = map.get(key) || { category: cat, rate, taxable: 0, tax: 0 };
      cur.taxable = round2(cur.taxable + net);
      cur.tax = round2(cur.tax + vat);
      map.set(key, cur);
    }
    return [...map.values()];
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function fmt(n: number): string {
  return round2(n).toFixed(2);
}
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
