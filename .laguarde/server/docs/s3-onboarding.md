# Publish the onboarding pages with S3

The static bundle lets an agent download and start Laguarde locally. No hosted
Laguarde server URL is required.

## 1. Export

```bash
bun run export:onboarding
```

Public download links are stored in `onboarding.config.json`. The current
configuration publishes:

- human documentation: `https://www.futur-panda.dev/laguarde/docs`;
- agent contract: `https://www.futur-panda.dev/laguarde/install`;
- ZIP: `https://www.futur-panda.dev/laguarde/zip`;
- checksum: the configured `filedn.eu` object.

This creates:

```text
static-onboarding/
├── index.html           # human guide
├── install              # agent contract, text/plain
├── laguarde.zip         # local server source package
└── laguarde.zip.sha256  # integrity checksum
```

The agent resolves the archive URLs relative to the `/install` URL, verifies the
checksum, extracts the server inside the current project, starts it with Docker
or Bun, and connects its MCP client to localhost.

## 2. Upload

```bash
aws s3 cp static-onboarding/index.html s3://YOUR-BUCKET/index.html \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public,max-age=300"

aws s3 cp static-onboarding/install s3://YOUR-BUCKET/install \
  --content-type "text/plain; charset=utf-8" \
  --cache-control "no-store"

aws s3 cp static-onboarding/laguarde.zip s3://YOUR-BUCKET/laguarde.zip \
  --content-type "application/zip" \
  --cache-control "no-store"

aws s3 cp static-onboarding/laguarde.zip.sha256 \
  s3://YOUR-BUCKET/laguarde.zip.sha256 \
  --content-type "text/plain; charset=utf-8" \
  --cache-control "no-store"
```

Configure `index.html` as the CloudFront default root object. Keep the S3
bucket private and grant CloudFront access through Origin Access Control.

After publishing:

- send the CloudFront root URL to humans;
- send `https://YOUR-CLOUDFRONT-DOMAIN/install` to agents.
