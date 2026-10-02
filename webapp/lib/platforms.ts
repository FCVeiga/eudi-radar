// Shared by client and server code: keep this module free of server imports.
export const PLATFORMS = {
  news: { label: 'News site / blog', placeholder: 'https://www.biometricupdate.com', connectable: true },
  reddit: { label: 'Reddit', placeholder: 'r/digitalidentity or u/username', connectable: true },
  twitter: { label: 'X / Twitter', placeholder: '@handle', connectable: false },
  linkedin: { label: 'LinkedIn', placeholder: 'https://www.linkedin.com/company/…', connectable: false },
} as const;
export type Platform = keyof typeof PLATFORMS;

export const CATEGORIES = ['MEDIA', 'REGULATOR', 'STANDARDS_BODY', 'COMPETITOR', 'PARTNER', 'PROGRAMME', 'COMMUNITY'] as const;
