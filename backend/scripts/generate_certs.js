const fs = require("fs");
const { exec } = require("child_process");
const path = require("path");

const certDir = "/certs"; // Inside container mount
const keyPath = path.join(certDir, "server.key");
const certPath = path.join(certDir, "server.crt");

// Ensure directory exists
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// OpenSSL Configuration for SANs
const opensslConfigPath = path.join(certDir, "openssl.cnf");
const opensslConfig = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = req_ext
x509_extensions = v3_req

[dn]
C = FR
ST = Nouvelle-Aquitaine
L = Bordeaux
O = Reden Solar
OU = IT
CN = Hyperviseur Local

[req_ext]
subjectAltName = @alt_names

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = backend
DNS.3 = frontend
IP.1 = 127.0.0.1
IP.2 = 10.14.10.14
`;

fs.writeFileSync(opensslConfigPath, opensslConfig);

console.log("Generating self-signed certificate with SANs...");

// Generate Key and Certificate
// openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout server.key -out server.crt -config openssl.cnf
const cmd = `openssl req -x509 -nodes -days 3650 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -config "${opensslConfigPath}"`;

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error("Error generating certificates:", error);
    console.error(stderr);
    process.exit(1);
  }
  console.log("Certificates generated successfully!");
  console.log(`Key: ${keyPath}`);
  console.log(`Cert: ${certPath}`);

  // Set permissions (global read)
  try {
    fs.chmodSync(keyPath, "644");
    fs.chmodSync(certPath, "644");
    console.log("Permissions updated.");
  } catch (e) {
    console.warn("Could not set permissions (Windows host?):", e.message);
  }
});
