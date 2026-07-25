# Publishing to the MCP Registry

Laguarde is distributed by npm and listed in the MCP Registry as
`dev.futur-panda/laguarde`. The Registry stores discovery metadata; npm remains
the source of the executable package.

The workflow in `.github/workflows/publish-mcp.yml` publishes Registry metadata
on a version tag or a manual dispatch. It verifies tests, build output, the
declared JSON Schema, local metadata consistency, and the already-published npm
package before publishing.

## One-time DNS authentication setup

The `dev.futur-panda` namespace requires proof of ownership of
`futur-panda.dev`.

Create an Ed25519 key outside the repository:

```bash
mkdir -p ~/.config/laguarde
chmod 700 ~/.config/laguarde
openssl genpkey -algorithm Ed25519 \
  -out ~/.config/laguarde/mcp-registry-key.pem
chmod 600 ~/.config/laguarde/mcp-registry-key.pem
```

Generate the public key:

```bash
openssl pkey \
  -in ~/.config/laguarde/mcp-registry-key.pem \
  -pubout -outform DER |
tail -c 32 |
base64
```

Add this TXT value at the apex of `futur-panda.dev` (`@` in many DNS control
panels):

```text
v=MCPv1; k=ed25519; p=THE_PUBLIC_KEY_FROM_ABOVE
```

Convert the private key to the format accepted by `mcp-publisher` and store it
as the GitHub Actions secret `MCP_PRIVATE_KEY`:

```bash
MCP_PRIVATE_KEY="$(
  openssl pkey \
    -in ~/.config/laguarde/mcp-registry-key.pem \
    -noout -text |
  grep -A3 "priv:" |
  tail -n +2 |
  tr -d ' :\n'
)"

printf '%s' "${MCP_PRIVATE_KEY}" |
  gh secret set MCP_PRIVATE_KEY --repo FuturPanda/laguarde

unset MCP_PRIVATE_KEY
```

Never commit the private key or print the GitHub secret.

## First publication

The workflow must be present on the default branch before it can be dispatched:

```bash
gh workflow run publish-mcp.yml \
  --repo FuturPanda/laguarde \
  --ref main
```

Inspect its result with:

```bash
gh run list \
  --repo FuturPanda/laguarde \
  --workflow publish-mcp.yml \
  --limit 1
```

## Future releases

Publish the npm package first, then push the matching version tag:

```bash
npm publish
git tag v0.2.1
git push origin v0.2.1
```

The workflow refuses a tag that does not match `package.json`, and refuses to
publish Registry metadata when npm does not expose the same version and
`mcpName`.
