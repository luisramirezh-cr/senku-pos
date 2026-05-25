import forge from 'node-forge'

export interface SignResult {
  signedXml: string
  certSerial: string
}

/**
 * Signs the CR Factura Electrónica XML using XMLDSig with RSA-SHA256.
 *
 * Signature structure:
 *  - DigestValue  = base64(SHA-256(xmlWithoutSignature))
 *  - SignatureValue = base64(RSA-PKCS1v15-SHA256(SignedInfo))
 *
 * Dev mode (DEV_MOCK_SESSION=true or no cert): returns XML with placeholder comment.
 */
export function signCrXml(xmlString: string, certBase64?: string, certPassword?: string): SignResult {
  if (!certBase64 || !certPassword || process.env.DEV_MOCK_SESSION === 'true') {
    const signed = xmlString.replace(
      '</FacturaElectronica>',
      '<!-- FIRMA_PENDIENTE: certificado no configurado o modo dev -->\n</FacturaElectronica>',
    )
    return { signedXml: signed, certSerial: 'DEV' }
  }

  const p12Der = forge.util.decode64(certBase64)
  const p12Asn1 = forge.asn1.fromDer(p12Der)
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, certPassword)

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })
  const keyBags  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })

  const certBag = certBags[forge.pki.oids.certBag]?.[0]
  const keyBag  = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0]

  if (!certBag?.cert || !keyBag?.key) {
    throw new Error('Certificado .p12 inválido: no se encontraron clave o certificado')
  }

  const cert = certBag.cert
  const privateKey = keyBag.key as forge.pki.rsa.PrivateKey
  const certSerial = cert.serialNumber

  // 1. DigestValue = base64(SHA-256(xmlWithoutSignature))
  const digestMd = forge.md.sha256.create()
  digestMd.update(xmlString, 'utf8')
  const digestValue = forge.util.encode64(digestMd.digest().bytes())

  // DER-encode the cert for KeyInfo
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()
  const certB64 = forge.util.encode64(certDer)

  // 2. Build SignedInfo (this is what gets signed)
  const signedInfo = [
    '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    '  <ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>',
    '  <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>',
    '  <ds:Reference URI="">',
    '    <ds:Transforms>',
    '      <ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>',
    '    </ds:Transforms>',
    '    <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>',
    `    <ds:DigestValue>${digestValue}</ds:DigestValue>`,
    '  </ds:Reference>',
    '</ds:SignedInfo>',
  ].join('\n')

  // 3. SignatureValue = base64(RSA-PKCS1v15-SHA256(signedInfo))
  const sigMd = forge.md.sha256.create()
  sigMd.update(signedInfo, 'utf8')
  const signatureValue = forge.util.encode64(privateKey.sign(sigMd))

  const signatureBlock = [
    '<ds:Signature Id="SignatureSenku" xmlns:ds="http://www.w3.org/2000/09/xmldsig#">',
    `  ${signedInfo}`,
    `  <ds:SignatureValue>${signatureValue}</ds:SignatureValue>`,
    '  <ds:KeyInfo>',
    '    <ds:X509Data>',
    `      <ds:X509Certificate>${certB64}</ds:X509Certificate>`,
    '    </ds:X509Data>',
    '  </ds:KeyInfo>',
    '</ds:Signature>',
  ].join('\n')

  const signedXml = xmlString.replace('</FacturaElectronica>', `${signatureBlock}\n</FacturaElectronica>`)
  return { signedXml, certSerial }
}
