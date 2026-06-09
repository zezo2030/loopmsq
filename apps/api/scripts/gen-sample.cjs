// Generates a sample unsigned UBL invoice using the compiled ZatcaXmlService.
// Run with plain node inside the build image (requires ./dist).
const { ZatcaXmlService } = require('../dist/integrations/zatca/zatca-xml.service');
const {
  InvoiceTransactionType,
  InvoiceDocumentType,
} = require('../dist/integrations/zatca/zatca.types');
const { randomUUID } = require('crypto');
const { writeFileSync } = require('fs');

const seller = {
  name: 'Organized Entertainment Trading Company',
  vatNumber: '311267633500003',
  identityScheme: 'CRN',
  identityValue: '1010101010',
  street: 'King Fahd Road',
  buildingNumber: '1234',
  plotIdentification: '9999',
  citySubdivision: 'Al Olaya',
  city: 'Riyadh',
  postalZone: '12345',
  countrySubentity: 'Riyadh',
  countryCode: 'SA',
  industry: 'Booking Services',
};

const xml = new ZatcaXmlService();
const out = xml.build(
  {
    invoiceNumber: 'INV-2026-000001',
    uuid: randomUUID(),
    icv: 1,
    pih: 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==',
    issuedAt: new Date(),
    transactionType: InvoiceTransactionType.SIMPLIFIED,
    documentType: InvoiceDocumentType.INVOICE,
    currency: 'SAR',
    lines: [
      { name: 'Booking (2 pax x 3h)', quantity: 1, unitPrice: 100, vatRate: 15, vatCategory: 'S' },
      { name: 'Extra add-on', quantity: 2, unitPrice: 25, vatRate: 15, vatCategory: 'S' },
    ],
  },
  seller,
);

const target = process.argv[2] || '/out/sample.xml';
writeFileSync(target, out, 'utf8');
console.log('wrote ' + target + ' (' + out.length + ' bytes)');
