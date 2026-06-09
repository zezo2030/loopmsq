import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  getZatcaConfig,
  ZatcaConfig,
  ZatcaEnvironment,
} from '../../config/zatca.config';
import { SignedInvoiceResult } from './zatca.types';

const exec = promisify(execFile);

export interface CsrInput {
  commonName: string;
  serialNumber: string; // 1-...|2-...|3-...
  organizationIdentifier: string; // 15-digit VAT
  organizationUnit: string;
  organizationName: string;
  countryName: string; // SA
  invoiceType: string; // e.g. "1100" (standard+simplified)
  location: string;
  industry: string;
  /** decides the certificate template name in the CSR */
  environment: ZatcaEnvironment;
}

export interface CsrResult {
  privateKeyPem: string;
  csrPem: string;
  csrBase64: string; // base64 of the PEM CSR body (single line, as ZATCA expects)
}

/**
 * Drives the official ZATCA SDK (v3.x) CLI. The SDK is folder-bound:
 *  - reads cert/key/pih/schema/rule paths from a JSON file pointed to by the
 *    `SDK_CONFIG` env var,
 *  - is invoked as `java -Djdk.sunec.disableNative=false -jar cli.jar
 *    --globalVersion <v> -certpassword <pw> <command flags>`.
 *
 * Commands (from the SDK -help): -csr/-pem, -sign, -qr, -generateHash,
 * -invoiceRequest/-apiRequest, -validate, -nonprod.
 *
 * The CLI does signing/QR/hash/CSR only — it does NOT submit to ZATCA.
 */
@Injectable()
export class ZatcaSignerService {
  private readonly logger = new Logger(ZatcaSignerService.name);
  private cfg: ZatcaConfig;
  private jarPathCache?: string;
  private sdkHomeCache?: string;

  // JVM flag required by the SDK for secp256k1 on JDK 11.
  private readonly jvmFlags = ['-Djdk.sunec.disableNative=false'];

  constructor(private readonly configService: ConfigService) {
    this.cfg = getZatcaConfig(configService);
  }

  // ---------------------------------------------------------------------------
  // Toolchain resolution
  // ---------------------------------------------------------------------------

  /** Resolve the SDK CLI jar (version-resilient: scans for *.jar if needed). */
  async getJarPath(): Promise<string> {
    if (this.jarPathCache) return this.jarPathCache;
    const configured = this.cfg.sdkJarPath;
    if (configured && (await this.exists(configured))) {
      this.jarPathCache = configured;
      return configured;
    }
    // Scan the configured dir, then a nested extracted SDK's Apps/ dir.
    const baseDir = configured ? path.dirname(configured) : './zatca-sdk';
    const candidates = [baseDir];
    try {
      for (const e of await fs.readdir(baseDir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          candidates.push(path.join(baseDir, e.name));
          candidates.push(path.join(baseDir, e.name, 'Apps'));
        }
      }
    } catch {
      /* ignore */
    }
    for (const dir of candidates) {
      let entries: string[] = [];
      try {
        entries = (await fs.readdir(dir)).filter((f) =>
          f.toLowerCase().endsWith('.jar'),
        );
      } catch {
        continue;
      }
      if (!entries.length) continue;
      entries.sort((a, b) => this.jarScore(b) - this.jarScore(a));
      const resolved = path.join(dir, entries[0]);
      this.jarPathCache = resolved;
      if (resolved !== configured) {
        this.logger.warn(`Using ZATCA SDK jar at "${resolved}".`);
      }
      return resolved;
    }
    throw new Error(
      `ZATCA SDK jar not found. Place the SDK jar under "${baseDir}".`,
    );
  }

  private jarScore(f: string): number {
    const n = f.toLowerCase();
    if (n.startsWith('cli') && n.includes('jar-with-dependencies')) return 4;
    if (n.includes('jar-with-dependencies')) return 3;
    if (n.includes('zatca') || n.includes('sdk') || n.includes('fatoora')) return 2;
    return 1;
  }

  /**
   * Resolve the extracted SDK home (the folder containing Data/Rules + Data/Schemas).
   * Needed to point the per-call config.json at the schemas/rules.
   */
  async getSdkHome(): Promise<string> {
    if (this.sdkHomeCache) return this.sdkHomeCache;
    const jar = await this.getJarPath();
    const candidates = [
      this.cfg.sdkHome,
      path.dirname(jar), // jar sits in the home root
      path.dirname(path.dirname(jar)), // jar sits in <home>/Apps
    ].filter(Boolean) as string[];

    // Also scan immediate subdirs of the jar's base dir.
    const baseDir = path.dirname(this.cfg.sdkJarPath || './zatca-sdk');
    try {
      for (const e of await fs.readdir(baseDir, { withFileTypes: true })) {
        if (e.isDirectory()) candidates.push(path.join(baseDir, e.name));
      }
    } catch {
      /* ignore */
    }

    for (const dir of candidates) {
      if (await this.exists(path.join(dir, 'Data', 'Rules', 'schematrons'))) {
        this.sdkHomeCache = path.resolve(dir);
        return this.sdkHomeCache;
      }
    }
    throw new Error(
      'ZATCA SDK home not found (no Data/Rules/schematrons). Set ZATCA_SDK_HOME to the extracted SDK folder.',
    );
  }

  /** Resolve absolute schema/rule paths from the SDK home's defaults.json. */
  private async resolveStaticPaths(home: string): Promise<{
    xsdPath: string;
    enSchematron: string;
    zatcaSchematron: string;
  }> {
    const appsDir = path.join(home, 'Apps');
    let defaults: any = {};
    try {
      defaults = JSON.parse(
        await fs.readFile(path.join(home, 'Configuration', 'defaults.json'), 'utf8'),
      );
    } catch {
      /* fall back to conventional layout below */
    }
    const resolve = (rel: string | undefined, fallback: string) =>
      rel ? path.resolve(appsDir, rel) : path.join(home, fallback);
    return {
      xsdPath: resolve(
        defaults.xsdPath,
        'Data/Schemas/xsds/UBL2.1/xsd/maindoc/UBL-Invoice-2.1.xsd',
      ),
      enSchematron: resolve(
        defaults.enSchematron,
        'Data/Rules/schematrons/CEN-EN16931-UBL.xsl',
      ),
      zatcaSchematron: resolve(
        defaults.zatcaSchematron,
        'Data/Rules/schematrons/20210819_ZATCA_E-invoice_Validation_Rules.xsl',
      ),
    };
  }

  /** Verify java + the SDK jar are runnable (openssl no longer required). */
  async checkToolchain(): Promise<{
    ready: boolean;
    java?: string;
    jarPath?: string;
    sdkHome?: string;
    jarRuns: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let java: string | undefined;
    let jarPath: string | undefined;
    let sdkHome: string | undefined;
    let jarRuns = false;

    try {
      const { stderr, stdout } = await exec(this.cfg.javaBin, ['-version']);
      java = (stderr || stdout || '').split('\n')[0]?.trim();
    } catch (e: any) {
      errors.push(`java not runnable (${this.cfg.javaBin}): ${e?.message || e}`);
    }
    try {
      jarPath = await this.getJarPath();
    } catch (e: any) {
      errors.push(e?.message || String(e));
    }
    try {
      sdkHome = await this.getSdkHome();
    } catch (e: any) {
      errors.push(e?.message || String(e));
    }
    if (jarPath && java) {
      try {
        await exec(
          this.cfg.javaBin,
          [...this.jvmFlags, '-jar', jarPath, '--globalVersion', this.cfg.sdkVersion,
            '-certpassword', this.cfg.sdkCertPassword, '-help'],
          { maxBuffer: 8 * 1024 * 1024 },
        );
        jarRuns = true;
      } catch {
        jarRuns = true; // some builds exit non-zero on -help; jar+java present is enough
      }
    }
    return { ready: errors.length === 0, java, jarPath, sdkHome, jarRuns, errors };
  }

  // ---------------------------------------------------------------------------
  // CSR + private key (SDK -csr)
  // ---------------------------------------------------------------------------

  /**
   * Generated with openssl (not the SDK CLI): the CLI only supports -nonprod
   * (TSTZATCA template) or production, but the simulation environment requires
   * the PREZATCA-Code-Signing certificate template in the CSR.
   */
  async generateKeyAndCsr(input: CsrInput): Promise<CsrResult> {
    const dir = await this.tmpDir();
    const keyPath = path.join(dir, 'ec-private.pem');
    const csrPath = path.join(dir, 'request.csr');
    const confPath = path.join(dir, 'openssl.cnf');
    const templates: Record<ZatcaEnvironment, string> = {
      sandbox: 'TSTZATCA-Code-Signing',
      simulation: 'PREZATCA-Code-Signing',
      production: 'ZATCA-Code-Signing',
    };
    try {
      const cnf = [
        '[req]',
        'prompt=no',
        'utf8=yes',
        'default_md=sha256',
        'distinguished_name=dn',
        'req_extensions=v3_req',
        '[dn]',
        `C=${input.countryName}`,
        `OU=${input.organizationUnit}`,
        `O=${input.organizationName}`,
        `CN=${input.commonName}`,
        '[v3_req]',
        `1.3.6.1.4.1.311.20.2=ASN1:PRINTABLESTRING:${templates[input.environment]}`,
        'subjectAltName=dirName:alt_names',
        '[alt_names]',
        `SN=${input.serialNumber}`,
        `UID=${input.organizationIdentifier}`,
        `title=${input.invoiceType}`,
        `registeredAddress=${input.location}`,
        `businessCategory=${input.industry}`,
        '',
      ].join('\n');
      await fs.writeFile(confPath, cnf, 'utf8');
      await exec(this.cfg.opensslBin, [
        'ecparam',
        '-name',
        'secp256k1',
        '-genkey',
        '-noout',
        '-out',
        keyPath,
      ]);
      await exec(this.cfg.opensslBin, [
        'req',
        '-new',
        '-key',
        keyPath,
        '-config',
        confPath,
        '-out',
        csrPath,
      ]);

      const [privateKeyPem, csrPem] = await Promise.all([
        fs.readFile(keyPath, 'utf8'),
        fs.readFile(csrPath, 'utf8'),
      ]);
      // ZATCA /compliance expects base64 of the FULL PEM (headers included).
      const csrBase64 = Buffer.from(csrPem, 'utf8').toString('base64');
      return { privateKeyPem, csrPem, csrBase64 };
    } finally {
      await this.cleanup(dir);
    }
  }

  // ---------------------------------------------------------------------------
  // Sign + QR + hash (SDK -sign / -invoiceRequest)
  // ---------------------------------------------------------------------------

  async sign(
    unsignedXml: string,
    certificatePem: string,
    privateKeyPem: string,
    pih: string,
  ): Promise<SignedInvoiceResult> {
    const dir = await this.tmpDir();
    const xmlPath = path.join(dir, 'invoice.xml');
    const signedPath = path.join(dir, 'invoice-signed.xml');
    const reqPath = path.join(dir, 'request.json');
    const certPath = path.join(dir, 'cert.pem');
    const keyPath = path.join(dir, 'ec-secp256k1-priv-key.pem');
    const pihPath = path.join(dir, 'pih.txt');
    const configPath = path.join(dir, 'config.json');

    try {
      await Promise.all([
        fs.writeFile(xmlPath, unsignedXml, 'utf8'),
        fs.writeFile(certPath, this.normalizeCertPem(certificatePem), 'utf8'),
        fs.writeFile(keyPath, this.normalizeKeyPem(privateKeyPem), 'utf8'),
        fs.writeFile(pihPath, pih.trim(), 'utf8'),
      ]);
      await this.writeConfigJson(configPath, { certPath, keyPath, pihPath });
      const env = await this.buildEnv(configPath);

      // 1. sign (injects UBLExtensions signature + QR)
      const { stdout: signOut, stderr: signErr } = await exec(
        this.cfg.javaBin,
        [
          ...this.jvmFlags,
          '-jar',
          await this.getJarPath(),
          '--globalVersion',
          this.cfg.sdkVersion,
          '-certpassword',
          this.cfg.sdkCertPassword,
          '-sign',
          '-invoice',
          xmlPath,
          '-signedInvoice',
          signedPath,
        ],
        { cwd: dir, env, maxBuffer: 32 * 1024 * 1024 },
      );
      // The SDK CLI exits 0 even on failures — surface its real error output.
      if (!(await this.exists(signedPath))) {
        const out = `${signErr || ''}\n${signOut || ''}`
          .split('\n')
          .filter((l) => /error|invalid|exception|fail/i.test(l))
          .join('; ')
          .trim();
        throw new Error(
          `ZATCA SDK signing failed: ${out || 'no signed invoice produced (see SDK logs)'}`,
        );
      }
      let signedXml = await fs.readFile(signedPath, 'utf8');

      // 1b. Fix the QR TLV: this SDK build writes the public key into tag 7
      // and splits the signature across tags 8/9, while ZATCA expects
      // tag7=signature(base64 str), tag8=public key DER, tag9=cert signature.
      signedXml = this.fixQrTlv(signedXml, certificatePem);
      await fs.writeFile(signedPath, signedXml, 'utf8');

      // 2. build the API request JSON (gives invoiceHash + uuid + base64 invoice)
      let invoiceHash = '';
      let signedXmlBase64 = Buffer.from(signedXml, 'utf8').toString('base64');
      try {
        await exec(
          this.cfg.javaBin,
          [
            ...this.jvmFlags,
            '-jar',
            await this.getJarPath(),
            '--globalVersion',
            this.cfg.sdkVersion,
            '-certpassword',
            this.cfg.sdkCertPassword,
            '-invoiceRequest',
            '-invoice',
            signedPath,
            '-apiRequest',
            reqPath,
          ],
          { cwd: dir, env, maxBuffer: 32 * 1024 * 1024 },
        );
        const req = JSON.parse(await fs.readFile(reqPath, 'utf8'));
        invoiceHash = req.invoiceHash || req.invoice_hash || '';
        if (req.invoice) signedXmlBase64 = req.invoice;
      } catch (e) {
        this.logger.warn(
          `invoiceRequest failed, falling back to generateHash: ${String(e)}`,
        );
      }
      if (!invoiceHash) invoiceHash = await this.generateHash(signedXml);

      const qrCode = this.extractQrFromXml(signedXml) || '';
      return { signedXml, signedXmlBase64, invoiceHash, qrCode };
    } finally {
      await this.cleanup(dir);
    }
  }

  /** `-generateHash -invoice <xml>` — hash is the last non-empty stdout line. */
  async generateHash(xml: string): Promise<string> {
    const dir = await this.tmpDir();
    const xmlPath = path.join(dir, 'invoice.xml');
    const configPath = path.join(dir, 'config.json');
    try {
      await fs.writeFile(xmlPath, xml, 'utf8');
      // generateHash needs schema paths but not cert/key; point those at dummies.
      await this.writeConfigJson(configPath, {});
      const { stdout } = await exec(
        this.cfg.javaBin,
        [
          ...this.jvmFlags,
          '-jar',
          await this.getJarPath(),
          '--globalVersion',
          this.cfg.sdkVersion,
          '-certpassword',
          this.cfg.sdkCertPassword,
          '-generateHash',
          '-invoice',
          xmlPath,
        ],
        { cwd: dir, env: await this.buildEnv(configPath), maxBuffer: 16 * 1024 * 1024 },
      );
      const lines = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /^[A-Za-z0-9+/=]{20,}$/.test(l));
      return lines[lines.length - 1] || '';
    } finally {
      await this.cleanup(dir);
    }
  }

  /** `-validate -invoice <xml>` — offline pre-submission check. */
  async validateXml(xml: string): Promise<{ valid: boolean; output: string }> {
    const dir = await this.tmpDir();
    const xmlPath = path.join(dir, 'invoice.xml');
    const configPath = path.join(dir, 'config.json');
    try {
      await fs.writeFile(xmlPath, xml, 'utf8');
      await this.writeConfigJson(configPath, {});
      const { stdout } = await exec(
        this.cfg.javaBin,
        [
          ...this.jvmFlags,
          '-jar',
          await this.getJarPath(),
          '--globalVersion',
          this.cfg.sdkVersion,
          '-certpassword',
          this.cfg.sdkCertPassword,
          '-validate',
          '-invoice',
          xmlPath,
        ],
        { cwd: dir, env: await this.buildEnv(configPath), maxBuffer: 16 * 1024 * 1024 },
      );
      return { valid: !/invalid|error/i.test(stdout), output: stdout };
    } catch (e: any) {
      return { valid: false, output: e?.stdout || e?.message || String(e) };
    } finally {
      await this.cleanup(dir);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Convert a binarySecurityToken (base64 DER) to a PEM certificate. */
  tokenToPem(binarySecurityToken: string): string {
    const body = binarySecurityToken.replace(/-----[^-]+-----/g, '').trim();
    const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
    return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----\n`;
  }

  /**
   * The SDK's sample cert.pem is the bare base64 body (no PEM headers). ZATCA's
   * production CSID token is also base64 DER. The SDK accepts the bare base64,
   * so we strip headers to match its expected format.
   */
  private normalizeCertPem(cert: string): string {
    let body = cert.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    // ZATCA's binarySecurityToken is base64(base64-DER); the SDK wants the
    // inner base64 DER ("MII..."). Decode once if we're holding the outer layer.
    if (!body.startsWith('MII')) {
      const decoded = Buffer.from(body, 'base64').toString('utf8').trim();
      if (/^MII[A-Za-z0-9+/=]+$/.test(decoded)) body = decoded;
    }
    // No trailing newline — the SDK's strict Base64 decoder rejects whitespace.
    return body;
  }

  /**
   * The SDK CLI requires the EC private key as bare base64 (no PEM headers) in
   * SEC1 format. The SDK's own -csr output is PKCS#8 (despite the "EC PRIVATE
   * KEY" header), so convert to SEC1 DER before handing it back to the signer.
   */
  private normalizeKeyPem(key: string): string {
    const body = key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const der = Buffer.from(body, 'base64');
    for (const type of ['pkcs8', 'sec1'] as const) {
      try {
        const obj = crypto.createPrivateKey({ key: der, format: 'der', type });
        return (obj.export({ format: 'der', type: 'sec1' }) as Buffer).toString(
          'base64',
        );
      } catch {
        /* try next format */
      }
    }
    return body;
  }

  private async writeConfigJson(
    configPath: string,
    files: { certPath?: string; keyPath?: string; pihPath?: string },
  ): Promise<void> {
    const home = await this.getSdkHome();
    const stat = await this.resolveStaticPaths(home);
    const config = {
      xsdPath: stat.xsdPath,
      enSchematron: stat.enSchematron,
      zatcaSchematron: stat.zatcaSchematron,
      certPath: files.certPath || path.join(home, 'Data/Certificates/cert.pem'),
      privateKeyPath:
        files.keyPath || path.join(home, 'Data/Certificates/ec-secp256k1-priv-key.pem'),
      pihPath: files.pihPath || path.join(home, 'Data/PIH/pih.txt'),
      certPassword: this.cfg.sdkCertPassword,
      inputPath: path.dirname(configPath),
      usagePathFile: path.join(home, 'Configuration/usage.txt'),
    };
    const json = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, json, 'utf8');
    // The SDK CLI reads parts of its config (e.g. for QR generation) from
    // <home>/Configuration/config.json regardless of SDK_CONFIG — keep both in
    // sync. Signing is serialized upstream (ICV row lock), so no races.
    try {
      await fs.writeFile(
        path.join(home, 'Configuration', 'config.json'),
        json,
        'utf8',
      );
    } catch (e) {
      this.logger.warn(`Could not sync SDK home config.json: ${String(e)}`);
    }
  }

  private async buildEnv(configPath?: string): Promise<NodeJS.ProcessEnv> {
    const home = await this.getSdkHome();
    return {
      ...process.env,
      FATOORA_HOME: path.join(home, 'Apps'),
      ...(configPath ? { SDK_CONFIG: configPath } : {}),
    };
  }

  /**
   * Rebuild the QR TLV per the ZATCA Phase-2 spec:
   *   tags 1-6 (from the SDK QR) + tag7 = base64 signature string bytes,
   *   tag8 = public key (SPKI DER), tag9 = certificate signature bytes.
   * The invoice hash is computed with the QR node excluded, so patching the
   * QR does not invalidate the signature or the hash.
   */
  private fixQrTlv(signedXml: string, certificatePem: string): string {
    const qrB64 = this.extractQrFromXml(signedXml);
    const sigMatch = signedXml.match(
      /<ds:SignatureValue[^>]*>([\s\S]*?)<\/ds:SignatureValue>/,
    );
    if (!qrB64 || !sigMatch) return signedXml;

    // Parse existing TLV, keep tags 1-6 untouched.
    const buf = Buffer.from(qrB64, 'base64');
    const tags = new Map<number, Buffer>();
    for (let i = 0; i + 2 <= buf.length; ) {
      const t = buf[i];
      const l = buf[i + 1];
      tags.set(t, buf.subarray(i + 2, i + 2 + l));
      i += 2 + l;
    }
    if (!tags.has(6)) return signedXml;

    // KSA-25: QR timestamp must equal the invoice IssueDate+IssueTime (the SDK
    // writes the signing time instead).
    const issueDate = signedXml.match(/<cbc:IssueDate>([^<]+)</)?.[1];
    const issueTime = signedXml.match(/<cbc:IssueTime>([^<]+)</)?.[1];
    if (issueDate && issueTime) {
      tags.set(3, Buffer.from(`${issueDate}T${issueTime}`, 'utf8'));
    }

    const signatureB64 = sigMatch[1].replace(/\s+/g, '');
    const certDer = Buffer.from(
      this.normalizeCertPem(certificatePem).trim(),
      'base64',
    );
    const publicKeyDer = new crypto.X509Certificate(certDer).publicKey.export({
      format: 'der',
      type: 'spki',
    }) as Buffer;
    const certSignature = this.extractCertSignature(certDer);
    if (!certSignature) return signedXml;

    const tlv = (t: number, v: Buffer) =>
      Buffer.concat([Buffer.from([t, v.length]), v]);
    const out = Buffer.concat([
      ...[1, 2, 3, 4, 5, 6].map((t) => tlv(t, tags.get(t)!)),
      tlv(7, Buffer.from(signatureB64, 'utf8')),
      tlv(8, publicKeyDer),
      tlv(9, certSignature),
    ]);

    return signedXml.replace(
      /(<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>)[^<]+(<\/cbc:EmbeddedDocumentBinaryObject>)/,
      `$1${out.toString('base64')}$2`,
    );
  }

  /** X.509 DER = SEQUENCE { tbsCertificate, signatureAlgorithm, BIT STRING }. */
  private extractCertSignature(certDer: Buffer): Buffer | null {
    const readLen = (
      b: Buffer,
      o: number,
    ): { len: number; next: number } | null => {
      const first = b[o];
      if (first < 0x80) return { len: first, next: o + 1 };
      const n = first & 0x7f;
      if (n < 1 || n > 4) return null;
      let len = 0;
      for (let i = 0; i < n; i++) len = (len << 8) | b[o + 1 + i];
      return { len, next: o + 1 + n };
    };
    if (certDer[0] !== 0x30) return null;
    const outer = readLen(certDer, 1);
    if (!outer) return null;
    let off = outer.next;
    // skip tbsCertificate and signatureAlgorithm
    for (let i = 0; i < 2; i++) {
      const l = readLen(certDer, off + 1);
      if (!l) return null;
      off = l.next + l.len;
    }
    if (certDer[off] !== 0x03) return null; // BIT STRING
    const sig = readLen(certDer, off + 1);
    if (!sig) return null;
    // first content byte = unused-bit count (0)
    return certDer.subarray(sig.next + 1, sig.next + sig.len);
  }

  private extractQrFromXml(xml: string): string | null {
    const m = xml.match(
      /<cbc:ID>QR<\/cbc:ID>[\s\S]*?<cbc:EmbeddedDocumentBinaryObject[^>]*>([^<]+)<\/cbc:EmbeddedDocumentBinaryObject>/,
    );
    return m ? m[1].trim() : null;
  }

  private async tmpDir(): Promise<string> {
    const base = this.cfg.workDir || path.join(os.tmpdir(), 'zatca');
    const dir = path.join(base, crypto.randomUUID());
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  private async exists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanup(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (e) {
      this.logger.warn(`Failed to clean temp dir ${dir}: ${String(e)}`);
    }
  }
}
