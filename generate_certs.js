const forge = require("node-forge");
const fs = require("fs");
const path = require("path");

console.log("Generating 2048-bit Key Pair...");
// Generate key pair
const keys = forge.pki.rsa.generateKeyPair(2048);

console.log("Creating Certificate...");
// Create certificate
const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = "01";
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);

const attrs = [
  { name: "commonName", value: "10.14.10.14" },
  { name: "countryName", value: "FR" },
  { shortName: "ST", value: "Nouvelle-Aquitaine" },
  { name: "localityName", value: "Roquefort" },
  { name: "organizationName", value: "Reden Solar" },
  { shortName: "OU", value: "IT" },
];

cert.setSubject(attrs);
cert.setIssuer(attrs);

// Set extensions
cert.setExtensions([
  {
    name: "basicConstraints",
    cA: true,
  },
  {
    name: "keyUsage",
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  },
  {
    name: "extKeyUsage",
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true,
  },
  {
    name: "nsCertType",
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true,
  },
  {
    name: "subjectAltName",
    altNames: [
      {
        type: 7, // IP
        ip: "10.14.10.14",
      },
      {
        type: 7, // IP
        ip: "127.0.0.1",
      },
      {
        type: 2, // DNS
        value: "backend",
      },
      {
        type: 2, // DNS
        value: "localhost",
      },
    ],
  },
]);

// Self-sign certificate
cert.sign(keys.privateKey, forge.md.sha256.create());

console.log("Writing files...");
const certDir = path.join(__dirname, "certs");
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir);
}

fs.writeFileSync(
  path.join(certDir, "server.key"),
  forge.pki.privateKeyToPem(keys.privateKey),
);
fs.writeFileSync(
  path.join(certDir, "server.crt"),
  forge.pki.certificateToPem(cert),
);

console.log("✅ Certificates generated successfully in /certs folder");
