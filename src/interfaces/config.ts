export interface AppleStoreKitConfig {
  /** The issuer ID from App Store Connect */
  issuerId: string;
  /** The key ID from App Store Connect */
  keyId: string;
  /** The private key content or path to .p8 file */
  privateKey: string;
  /** Your app's bundle identifier */
  bundleId: string;
  /** Optional environment setting. If not specified, will try production first */
  environment?: 'sandbox' | 'production';
} 