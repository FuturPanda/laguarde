function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function normalizePublicOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("The Laguarde URL must be an absolute HTTP(S) URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The Laguarde URL must use HTTP or HTTPS");
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Use only the Laguarde origin, without credentials, path, query, or fragment",
    );
  }
  return url.origin;
}

export function buildStaticHumanGuide(
  source: string,
  laguardeOrigin: string,
  publicLinks: {
    docsUrl?: string;
    installUrl?: string;
    packageName?: string;
    packageVersion?: string;
    packageUrl?: string;
  } = {},
): string {
  const replacements: Record<string, string> = {
    "laguarde-backend-url": laguardeOrigin,
    "laguarde-docs-url": publicLinks.docsUrl ?? "",
    "laguarde-install-url": publicLinks.installUrl ?? "",
    "laguarde-package-name": publicLinks.packageName ?? "",
    "laguarde-package-version": publicLinks.packageVersion ?? "",
    "laguarde-package-url": publicLinks.packageUrl ?? "",
  };
  let configured = source;
  for (const [name, value] of Object.entries(replacements)) {
    const marker = `<meta name="${name}" content="" />`;
    if (!configured.includes(marker)) {
      throw new Error(`Human guide is missing its ${name} marker`);
    }
    configured = configured.replace(
      marker,
      `<meta name="${name}" content="${escapeHtmlAttribute(value)}" />`,
    );
  }

  return configured.replace(
    '<a class="brand" href="/guide">',
    '<a class="brand" href="./">',
  );
}
