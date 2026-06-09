const { ZatcaXmlService } = require('../dist/integrations/zatca/zatca-xml.service');
const { InvoiceTransactionType, InvoiceDocumentType } = require('../dist/integrations/zatca/zatca.types');
const { randomUUID } = require('crypto');
const { writeFileSync } = require('fs');
const seller = { name:'Organized Entertainment Trading Company', vatNumber:'311267633500003', identityScheme:'CRN', identityValue:'1010101010', street:'King Fahd Road', buildingNumber:'1234', plotIdentification:'9999', citySubdivision:'Al Olaya', city:'Riyadh', postalZone:'12345', countrySubentity:'Riyadh', countryCode:'SA', industry:'Booking Services' };
const xml = new ZatcaXmlService();
const out = xml.build({
  invoiceNumber:'INV-2026-000002', uuid:randomUUID(), icv:2,
  pih:'X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=',
  issuedAt:new Date(), transactionType:InvoiceTransactionType.STANDARD, documentType:InvoiceDocumentType.INVOICE, currency:'SAR',
  lines:[{ name:'Corporate booking', quantity:1, unitPrice:100, vatRate:15, vatCategory:'S' }],
  customer:{ name:'Acme Co', vatNumber:'399999999900003', identityScheme:'CRN', identityValue:'2020202020', street:'Olaya St', buildingNumber:'5678', plotIdentification:'8888', citySubdivision:'Al Malaz', city:'Riyadh', postalZone:'54321', countrySubentity:'Riyadh', countryCode:'SA' },
}, seller);
writeFileSync(process.argv[2]||'/out/b2b.xml', out); console.log('wrote b2b '+out.length+' bytes');
