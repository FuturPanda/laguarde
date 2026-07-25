# Publish the onboarding pages with S3

The static bundle tells an agent how to configure the published npm package. No
hosted Laguarde server URL, ZIP, or checksum file is required.

## 1. Export

```bash
bun run export:onboarding
```

Public download links are stored in `onboarding.config.json`. The current
configuration publishes:

- human documentation: `https://www.futur-panda.dev/laguarde/docs`;
- agent contract: `https://www.futur-panda.dev/laguarde/install`;
- npm package: `laguarde-mcp@0.2.0`.

This creates:

```text
static-onboarding/
├── index.html           # human guide
└── install              # agent contract, text/plain
```

The agent reads `/install`, verifies the package identity through npm, and adds
a project-scoped stdio MCP configuration using
`npx -y laguarde-mcp@0.2.0`.

## 2. Upload

```bash
aws s3 cp static-onboarding/index.html s3://YOUR-BUCKET/index.html \
  --content-type "text/html; charset=utf-8" \
  --cache-control "public,max-age=300"

aws s3 cp static-onboarding/install s3://YOUR-BUCKET/install \
  --content-type "text/plain; charset=utf-8" \
  --cache-control "no-store"
```

Configure `index.html` as the CloudFront default root object. Keep the S3
bucket private and grant CloudFront access through Origin Access Control.

After publishing:

- send the CloudFront root URL to humans;
- send `https://YOUR-CLOUDFRONT-DOMAIN/install` to agents.

Publish the npm package before uploading these pages so the pinned command is
available when an agent follows the contract.
