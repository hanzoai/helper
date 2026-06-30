/**
 * Brand white-labeling — one codebase, every ecosystem.
 *
 * The helper is identical for Hanzo, Lux, and Zoo; only the default endpoints,
 * OAuth client id, and display strings differ. A fork (`@luxfi/helper`,
 * `@zooai/helper`) sets `HANZO_BRAND` (or ships a build that defaults it) and
 * inherits everything else. Explicit HANZO_IAM_URL / HANZO_API_URL /
 * HANZO_CLIENT_ID always win, so any deployment can be pointed anywhere.
 *
 * Per the white-label rules: lux.network → Lux, zoo.ngo → Zoo, hanzo.ai → Hanzo;
 * a deployment never shows another brand's identity.
 */

export interface Brand {
  id: 'hanzo' | 'lux' | 'zoo' | 'zen';
  /** Display name used in CLI copy. */
  name: string;
  /** Binary / command name. */
  bin: string;
  /** IAM issuer base (OIDC; all IAM ops are relative to this). */
  iam: string;
  /** Cloud API base (account, models, inference). */
  api: string;
  /** OAuth client id seeded in IAM with the device_code grant. */
  clientId: string;
  /** Public web root — ecosystem install/download pages hang off it. */
  site: string;
}

const BRANDS: Record<Brand['id'], Brand> = {
  hanzo: {
    id: 'hanzo',
    name: 'Hanzo',
    bin: 'hanzo',
    iam: 'https://hanzo.id/v1/iam',
    api: 'https://api.hanzo.ai',
    clientId: 'hanzo-app',
    site: 'https://hanzo.ai',
  },
  lux: {
    id: 'lux',
    name: 'Lux',
    bin: 'lux',
    iam: 'https://lux.id/v1/iam',
    api: 'https://api.lux.network',
    clientId: 'lux-app',
    site: 'https://lux.network',
  },
  zoo: {
    id: 'zoo',
    name: 'Zoo',
    bin: 'zoo',
    iam: 'https://zoolabs.id/v1/iam',
    api: 'https://api.zoo.ngo',
    clientId: 'zoo-app',
    site: 'https://zoo.ngo',
  },
  zen: {
    id: 'zen',
    name: 'Zen',
    bin: 'zen',
    iam: 'https://id.zenlm.org/v1/iam',
    api: 'https://api.zenlm.org',
    clientId: 'zen-app',
    site: 'https://zenlm.org',
  },
};

/**
 * The active brand. Defaults to Hanzo; a fork sets HANZO_BRAND=lux|zoo (or bakes
 * it into its build). Unknown values fall back to Hanzo rather than crash.
 */
export const brand: Brand =
  BRANDS[(process.env['HANZO_BRAND'] as Brand['id']) ?? 'hanzo'] ?? BRANDS.hanzo;
