#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 4 ]]; then
  echo "usage: $0 <ccb-source> <tauri-src> <ccb-revision> <node-version>" >&2
  exit 2
fi

ccb_source=$1
tauri_src=$2
expected_ccb_revision=$3
expected_node_version=${4#v}
runtime_root="$tauri_src/agent-runtime"

actual_ccb_revision=$(git -C "$ccb_source" rev-parse HEAD)
if [[ "$actual_ccb_revision" != "$expected_ccb_revision" ]]; then
  echo "CCB revision mismatch: expected $expected_ccb_revision, got $actual_ccb_revision" >&2
  exit 1
fi

ccb_version=$(node -e '
  const fs = require("node:fs");
  process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).version);
' "$ccb_source/package.json")
actual_node_version=$(node -p 'process.versions.node')
if [[ "$actual_node_version" != "$expected_node_version" ]]; then
  echo "Node.js version mismatch: expected $expected_node_version, got $actual_node_version" >&2
  exit 1
fi

test -f "$ccb_source/dist/cli-node.js"
test -f "$ccb_source/dist/cli.js"
test -d "$ccb_source/dist/vendor/ripgrep"
if find "$ccb_source/dist" -type l -print -quit | grep -q .; then
  echo "CCB dist must not contain symbolic links" >&2
  exit 1
fi

case "$runtime_root" in
  */src-tauri/agent-runtime) ;;
  *)
    echo "Refusing to replace unexpected runtime path: $runtime_root" >&2
    exit 1
    ;;
esac

rm -rf "$runtime_root"
mkdir -p "$runtime_root/ccb" "$runtime_root/node"
cp -R "$ccb_source/dist" "$runtime_root/ccb/dist"

node_executable=$(command -v node)
case "${RUNNER_OS:-}" in
  Windows)
    cp "$node_executable" "$runtime_root/node/node.exe"
    node_license="$(dirname "$node_executable")/LICENSE"
    test -f "$node_license"
    cp "$node_license" "$runtime_root/node/LICENSE"
    bundled_node="$runtime_root/node/node.exe"
    ;;
  macOS|Linux)
    mkdir -p "$runtime_root/node/bin"
    cp "$node_executable" "$runtime_root/node/bin/node"
    chmod 0755 "$runtime_root/node/bin/node"
    node_license="$(cd "$(dirname "$node_executable")/.." && pwd)/LICENSE"
    test -f "$node_license"
    cp "$node_license" "$runtime_root/node/LICENSE"
    bundled_node="$runtime_root/node/bin/node"
    ;;
  *)
    echo "Unsupported runner OS: ${RUNNER_OS:-unset}" >&2
    exit 1
    ;;
esac

"$bundled_node" -e '
  const fs = require("node:fs");
  const [path, ccbVersion, ccbRevision, nodeVersion] = process.argv.slice(1);
  fs.writeFileSync(path, JSON.stringify({
    schemaVersion: 1,
    runtime: "ccb",
    ccbVersion,
    ccbRevision,
    nodeVersion,
    distributionScope: "internal-testing",
    licenseReviewRequired: true
  }, null, 2) + "\n");
' "$runtime_root/manifest.json" "$ccb_version" "$actual_ccb_revision" "$actual_node_version"

"$bundled_node" "$runtime_root/ccb/dist/cli-node.js" --version
test -s "$runtime_root/manifest.json"
echo "Prepared Claritide CCB $ccb_version ($actual_ccb_revision) with Node.js $actual_node_version"
