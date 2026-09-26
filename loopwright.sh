#!/usr/bin/env bash
set -euo pipefail

[ -n "${BASH_VERSION:-}" ] || { printf 'error: run this script with bash\n' >&2; exit 1; }

SCRIPT_VERSION="1.4.0"
OWNER="rebase-lat"
REPO="loopwright"
STATE_DIR=".loopwright"
LIB_REL=".opencode/lib/installer-lib.mjs"
MERGED_FILES="opencode.json,tui.json,.gitignore"

usage() {
  cat <<'EOF'
loopwright.sh — install, update, and check the Loopwright harness

usage: loopwright.sh <command> [options]

commands:
  install     install the harness into --project (default: .)
  update      update an installed harness to the latest (or --version) release
  doctor      detect errors; exit 0 clean, 1 findings, 2 not installed
  fix         repair mechanical problems (restores, deps, config keys)
  status      show installed version, drift, and update availability
  uninstall   remove harness-owned files (keeps project + foundation files)
  version     print this script's version

options:
  --project DIR       target project directory (default: .)
  --version TAG       release tag to install/update to (default: latest)
  --source local DIR  use a local checkout instead of fetching from GitHub
  --dry-run           plan only; write nothing
  --yes               overwrite colliding files without prompting
  --no-deps           skip npm install in .opencode/
  --offline           skip the latest-version check
  --no-opencode       skip opencode binary/agent checks
  --force             reinstall/reconcile even when already installed
  --json              (doctor) findings as JSON

bootstrap:
  gh api repos/rebase-lat/loopwright/contents/loopwright.sh \
    -H "Accept: application/vnd.github.raw" > loopwright.sh && chmod +x loopwright.sh
  ./loopwright.sh install
EOF
}

log() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    openssl dgst -sha256 "$1" | awk '{print $NF}'
  fi
}

PROJECT="."
VERSION=""
SOURCE_MODE=""
SOURCE_DIR=""
DRY_RUN=0
ASSUME_YES=0
NO_DEPS=0
OFFLINE=0
NO_OPENCODE=0
FORCE=0
JSON_OUT=0

SUBCMD="${1:-help}"
if [ $# -gt 0 ]; then shift; fi
while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      PROJECT="${2:?--project needs a directory}"
      shift 2
      ;;
    --version)
      VERSION="${2:?--version needs a tag}"
      shift 2
      ;;
    --source)
      [ "${2:-}" = "local" ] || die "--source only supports: local <dir>"
      SOURCE_MODE="local"
      SOURCE_DIR="${3:?--source local needs a directory}"
      shift 3
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --yes | -y)
      ASSUME_YES=1
      shift
      ;;
    --no-deps)
      NO_DEPS=1
      shift
      ;;
    --offline)
      OFFLINE=1
      shift
      ;;
    --no-opencode)
      NO_OPENCODE=1
      shift
      ;;
    --force)
      FORCE=1
      shift
      ;;
    --json)
      JSON_OUT=1
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1 (see --help)"
      ;;
  esac
done

PROJECT="$(cd "$PROJECT" 2>/dev/null && pwd)" || die "project directory not found"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-.}")" 2>/dev/null && pwd || pwd)"
MANIFEST="$PROJECT/$STATE_DIR/manifest.json"
STATE="$PROJECT/$STATE_DIR"
TMPROOT="$(mktemp -d)"
cleanup() { rm -rf "$TMPROOT"; }
trap cleanup EXIT
FINDINGS="$TMPROOT/findings.tsv"
: >"$FINDINGS"
BACKUP_DIR=""
AGENTS_FILE="AGENTS.md"
STAGE=""
BASE_DIR=""
REF=""
LIB=""
MANIFEST_TSV=""
ACTIONS_LOG="$TMPROOT/actions.txt"
: >"$ACTIONS_LOG"

add_finding() {
  printf '%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "${4:-}" >>"$FINDINGS"
}

count_level() {
  awk -F'\t' -v lvl="$1" '$1 == lvl {n++} END {print n + 0}' "$FINDINGS"
}

soft_rc() {
  if [ "$(count_level ERROR)" -gt 0 ] || [ "$(count_level WARN)" -gt 0 ]; then
    return 1
  fi
  return 0
}

emit_report_plain() {
  local lvl code msg hint
  while IFS=$'\t' read -r lvl code msg hint; do
    [ -n "$lvl" ] || continue
    hint="${hint:-}"
    if [ -n "$hint" ]; then
      printf '[%s] %s — %s\n' "$lvl" "$msg" "$hint"
    else
      printf '[%s] %s\n' "$lvl" "$msg"
    fi
  done <"$FINDINGS"
}

emit_report() {
  if [ -z "$LIB" ]; then
    emit_report_plain
    return 0
  fi
  if [ "$JSON_OUT" = 1 ]; then
    node "$LIB" report --format json <"$FINDINGS"
  else
    node "$LIB" report --format text <"$FINDINGS"
  fi
}

manifest_get() {
  node -e 'const fs=require("node:fs");const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const v=m[process.argv[2]];process.stdout.write(v==null||typeof v==="object"?"":String(v));' "$MANIFEST" "$1"
}

manifest_files() {
  node -e 'const fs=require("node:fs");const m=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));for(const k of Object.keys(m.files).sort())process.stdout.write(k+"\x1f"+m.files[k].sha256+"\x1f"+(m.files[k].state??"")+"\x1f"+(m.files[k].created?"created":"")+"\n");' "$MANIFEST"
}

find_lib() {
  local c
  for c in \
    "${STAGE:+$STAGE/harness/$LIB_REL}" \
    "$PROJECT/$LIB_REL" \
    "$SCRIPT_DIR/harness/$LIB_REL"; do
    if [ -n "$c" ] && [ -f "$c" ]; then
      printf '%s' "$c"
      return 0
    fi
  done
  return 1
}

validate_ref() {
  case "$1" in
    "" | -* | *..* | *[!A-Za-z0-9._/-]*) die "invalid version/ref: $1" ;;
  esac
}

token() {
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    printf '%s' "$GITHUB_TOKEN"
  elif [ -n "${GH_TOKEN:-}" ]; then
    printf '%s' "$GH_TOKEN"
  elif command -v gh >/dev/null 2>&1; then
    gh auth token 2>/dev/null || true
  fi
}

latest_tag() {
  local tk out
  tk="$(token)"
  : >"$TMPROOT/curlrc"
  if [ -n "$tk" ]; then
    printf 'header = "Authorization: Bearer %s"\n' "$tk" >"$TMPROOT/curlrc"
  fi
  if out="$(curl -fsSL -K "$TMPROOT/curlrc" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/tags?per_page=100")"; then
    printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",(c)=>(s+=c));process.stdin.on("end",()=>{try{const t=JSON.parse(s).map((x)=>x.name);t.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:"base"}));process.stdout.write(t[t.length-1]??"");}catch{process.stdout.write("");}});'
  fi
}

resolve_version() {
  if [ -n "$VERSION" ]; then
    printf '%s' "$VERSION"
    return 0
  fi
  if [ "$SOURCE_MODE" = "local" ]; then
    printf 'local'
    return 0
  fi
  local tag
  tag="$(latest_tag || true)"
  if [ -z "$tag" ]; then
    die "could not determine the latest release tag (offline? use --version <tag>)"
  fi
  printf '%s' "$tag"
}

version_gt() {
  local top
  top="$(printf '%s\n%s\n' "$1" "$2" | sort -V | tail -n 1)"
  if [ "$top" = "$1" ] && [ "$1" != "$2" ]; then return 0; fi
  return 1
}

tar_guarded() {
  local archive="$1" dest="$2" listing
  listing="$(tar -tzf "$archive")" || die "cannot list payload archive"
  if printf '%s\n' "$listing" | grep -qE '(^/|(^|/)\.\.(/|$))'; then
    die "refusing to extract an archive with unsafe paths"
  fi
  mkdir -p "$dest"
  tar -xzf "$archive" --strip-components=1 -C "$dest"
}

fetch_remote() {
  local ref="$1" dest="$2" tk url
  need curl
  tk="$(token)"
  : >"$TMPROOT/curlrc"
  if [ -n "$tk" ]; then
    printf 'header = "Authorization: Bearer %s"\n' "$tk" >"$TMPROOT/curlrc"
  fi
  url="https://codeload.github.com/$OWNER/$REPO/tar.gz/$ref"
  if ! curl -fsSL -K "$TMPROOT/curlrc" "$url" -o "$TMPROOT/payload.tgz"; then
    if [ -z "$tk" ]; then
      die "cannot fetch $ref: $OWNER/$REPO is private or unreachable.
  run 'gh auth login' or set GITHUB_TOKEN, then retry."
    fi
    die "cannot fetch $ref from $url (network problem, or unknown tag?)"
  fi
  tar_guarded "$TMPROOT/payload.tgz" "$dest"
}

stage_local() {
  local src="$1" dest="$2"
  mkdir -p "$dest"
  if git -C "$src" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git -C "$src" ls-files -z --cached --others --exclude-standard -- harness CHANGELOG.md loopwright.sh |
      while IFS= read -r -d '' f; do
        if [ -f "$src/$f" ]; then printf '%s\0' "$f"; fi
      done |
      tar -C "$src" --null -T - -cf - | tar -C "$dest" -xf -
  else
    local items=(harness CHANGELOG.md)
    if [ -f "$src/loopwright.sh" ]; then items+=(loopwright.sh); fi
    tar -C "$src" \
      --exclude='harness/.opencode/node_modules' \
      --exclude='harness/node_modules' \
      --exclude='harness/.opencode/package-lock.json' \
      --exclude='harness/docs/constitution.md' \
      --exclude='harness/docs/context.md' \
      --exclude='harness/docs/state.md' \
      --exclude='harness/docs/audit.md' \
      --exclude='harness/.env' --exclude='harness/.env.*' \
      --exclude='harness/*.pem' --exclude='harness/*.key' \
      --exclude='harness/secrets' \
      -cf - "${items[@]}" | tar -C "$dest" -xf -
  fi
}

prepare_stage() {
  STAGE="$TMPROOT/stage"
  mkdir -p "$STAGE"
  if [ "$SOURCE_MODE" = "local" ]; then
    SOURCE_DIR="$(cd "$SOURCE_DIR" 2>/dev/null && pwd)" || die "source directory not found"
    stage_local "$SOURCE_DIR" "$STAGE"
  else
    fetch_remote "$REF" "$STAGE"
  fi
  if [ ! -f "$STAGE/harness/opencode.json" ] || [ ! -d "$STAGE/harness/.opencode/commands" ]; then
    die "payload looks incomplete (missing harness/opencode.json or harness/.opencode/commands)"
  fi
}

dest_path() {
  if [ "$1" = "AGENTS.md" ]; then
    printf '%s' "$PROJECT/$AGENTS_FILE"
  else
    printf '%s' "$PROJECT/$1"
  fi
}

payload_src() {
  if [ "$1" = "loopwright.sh" ]; then
    printf '%s' "$STAGE/loopwright.sh"
  else
    printf '%s' "$STAGE/harness/$1"
  fi
}

backup_file() {
  if [ "$DRY_RUN" = 1 ]; then return 0; fi
  local src="$1" rel
  if [ ! -f "$src" ]; then return 0; fi
  rel="${src#"$PROJECT"/}"
  mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
  cp -p "$src" "$BACKUP_DIR/$rel"
}

backup_before_write() {
  local dest="$1" base="${2:-}"
  if [ ! -f "$dest" ]; then return 0; fi
  if [ -n "$base" ] && [ -f "$base" ] && [ "$(sha256 "$dest")" = "$(sha256 "$base")" ]; then
    return 0
  fi
  backup_file "$dest"
}

install_file() {
  if [ "$DRY_RUN" = 1 ]; then return 0; fi
  mkdir -p "$(dirname "$2")"
  cp "$1" "$2"
}

record_action() {
  printf '%s\n' "$*" >>"$ACTIONS_LOG"
}

run_merge_config() {
  local src="$1" dest="$2" base="${3:-}" out rc
  local ours="$dest"
  local args
  if [ ! -f "$dest" ]; then
    printf '{}\n' >"$TMPROOT/empty-ours.json"
    ours="$TMPROOT/empty-ours.json"
  fi
  args=(merge-config --theirs "$src" --ours "$ours" --out "$TMPROOT/merged-config.json")
  if [ -n "$base" ] && [ -f "$base" ]; then
    args+=(--base "$base")
  fi
  if [ "$AGENTS_FILE" != "AGENTS.md" ]; then
    args+=(--instructions-name "$AGENTS_FILE")
  fi
  if [ "${4:-}" = "force" ]; then
    args+=(--force)
  fi
  rc=0
  out="$(node "$LIB" "${args[@]}")" || rc=$?
  if [ "$rc" -ne 0 ]; then
    die "failed to merge ${dest#"$PROJECT"/} — fix the JSON/JSONC error above, then re-run"
  fi
  if [ -n "$out" ]; then
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      add_finding WARN config-conflict "${dest#"$PROJECT"/}: ${line#conflict$'\t'}" \
        "pre-change copy is in $STATE_DIR/backups/"
    done <<<"$out"
  fi
  if [ ! -f "$dest" ] || [ "$(sha256 "$dest")" != "$(sha256 "$TMPROOT/merged-config.json")" ]; then
    backup_before_write "$dest" "$base"
    install_file "$TMPROOT/merged-config.json" "$dest"
    record_action "merged ${dest#"$PROJECT"/}"
  fi
}

run_union_gitignore() {
  local src="$1" dest="$2" ours="$2"
  if [ ! -f "$dest" ]; then
    : >"$TMPROOT/empty-gitignore"
    ours="$TMPROOT/empty-gitignore"
  fi
  node "$LIB" union-gitignore --theirs "$src" --ours "$ours" --out "$TMPROOT/merged-gitignore"
  if [ ! -f "$dest" ] || [ "$(sha256 "$dest")" != "$(sha256 "$TMPROOT/merged-gitignore")" ]; then
    backup_before_write "$dest" ""
    install_file "$TMPROOT/merged-gitignore" "$dest"
    record_action "updated ${dest#"$PROJECT"/}"
  fi
}

handle_plain() {
  local rel="$1" src="$2" dest="$3" base="${4:-}" mode="$5" rc
  if [ ! -f "$dest" ]; then
    if [ "$mode" = "update" ] && [ -n "$base" ] && [ -f "$base" ]; then
      if [ "$(sha256 "$base")" = "$(sha256 "$src")" ]; then
        record_action "kept-removed $rel"
        return 0
      fi
      install_file "$src" "$dest"
      record_action "restored $rel"
      return 0
    fi
    install_file "$src" "$dest"
    record_action "copied $rel"
    return 0
  fi
  if [ -z "$base" ] || [ ! -f "$base" ]; then
    if [ "$(sha256 "$dest")" = "$(sha256 "$src")" ]; then
      record_action "unchanged $rel"
      return 0
    fi
    backup_before_write "$dest" ""
    install_file "$src" "$dest"
    record_action "replaced $rel"
    return 0
  fi
  if [ "$(sha256 "$dest")" = "$(sha256 "$base")" ]; then
    if [ "$(sha256 "$dest")" != "$(sha256 "$src")" ]; then
      backup_before_write "$dest" "$base"
      install_file "$src" "$dest"
      record_action "updated $rel"
    else
      record_action "unchanged $rel"
    fi
    return 0
  fi
  rc=0
  git merge-file -p -L ours -L base -L theirs "$dest" "$base" "$src" \
    >"$TMPROOT/merged-text" 2>/dev/null || rc=$?
  if [ "$rc" -eq 0 ]; then
    backup_before_write "$dest" "$base"
    install_file "$TMPROOT/merged-text" "$dest"
    record_action "merged $rel"
  elif [ "$rc" -eq 1 ]; then
    backup_before_write "$dest" "$base"
    install_file "$TMPROOT/merged-text" "$dest"
    record_action "CONFLICT $rel"
    printf '%s\n' "$rel" >>"$TMPROOT/conflict_list.txt"
    add_finding ERROR merge-conflict "$rel: update left conflict markers" \
      "resolve the <<<<<<< markers in $rel, then run: loopwright.sh fix"
  else
    die "3-way merge failed for $rel (git merge-file exit $rc)"
  fi
}

engine() {
  local mode="$1" rel src dest base dest_existed
  local tsv="$TMPROOT/manifest.tsv"
  local stage_list="$TMPROOT/stage_rels.txt"
  : >"$tsv"
  : >"$stage_list"
  : >"$TMPROOT/conflict_list.txt"
  : >"$TMPROOT/created_list.txt"
  while IFS= read -r -d '' f; do
    printf '%s\n' "${f#"$STAGE/harness/"}" >>"$stage_list"
  done < <(find "$STAGE/harness" -type f -print0)
  if [ -f "$STAGE/loopwright.sh" ]; then
    printf 'loopwright.sh\n' >>"$stage_list"
  fi
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    src="$(payload_src "$rel")"
    dest="$(dest_path "$rel")"
    dest_existed=0
    if [ -e "$dest" ]; then dest_existed=1; fi
    base=""
    if [ "$mode" = "update" ] && [ -n "$BASE_DIR" ] && [ -f "$BASE_DIR/$rel" ]; then
      base="$BASE_DIR/$rel"
    fi
    case "$rel" in
      opencode.json | tui.json)
        run_merge_config "$src" "$dest" "$base"
        ;;
      .gitignore)
        run_union_gitignore "$src" "$dest"
        ;;
      *)
        handle_plain "$rel" "$src" "$dest" "$base" "$mode"
        ;;
    esac
    if [ "$dest_existed" = 0 ] && [ -f "$dest" ]; then
      printf '%s\n' "$rel" >>"$TMPROOT/created_list.txt"
    fi
    if [ -f "$dest" ]; then
      printf '%s\t%s\n' "$rel" "$(sha256 "$dest")" >>"$tsv"
    fi
  done <"$stage_list"
  if [ -f "$MANIFEST" ]; then
    while IFS=$'\x1f' read -r rel _want _state _extra; do
      [ -n "$rel" ] || continue
      if grep -Fxq "$rel" "$stage_list"; then continue; fi
      dest="$(dest_path "$rel")"
      if [ -f "$dest" ]; then
        base="$BASE_DIR/$rel"
        if [ -n "$BASE_DIR" ] && [ -f "$base" ] && [ "$(sha256 "$dest")" = "$(sha256 "$base")" ]; then
          if [ "$DRY_RUN" = 1 ]; then
            record_action "pruned $rel"
          else
            rm "$dest"
            record_action "pruned $rel"
          fi
        else
          record_action "kept $rel (upstream removed; local copy kept)"
          add_finding WARN upstream-removed "$rel: no longer shipped; kept your local copy" \
            "delete it yourself if it is obsolete"
        fi
      fi
    done < <(manifest_files "$MANIFEST")
  fi
  MANIFEST_TSV="$tsv"
}

make_stage_list() {
  : >"$TMPROOT/stage_rels.txt"
  if [ -z "$STAGE" ]; then return 0; fi
  while IFS= read -r -d '' f; do
    printf '%s\n' "${f#"$STAGE/harness/"}" >>"$TMPROOT/stage_rels.txt"
  done < <(find "$STAGE/harness" -type f -print0)
  if [ -f "$STAGE/loopwright.sh" ]; then
    printf 'loopwright.sh\n' >>"$TMPROOT/stage_rels.txt"
  fi
}

confirm_collisions() {
  local collisions="$TMPROOT/collisions.txt" rel dest n
  : >"$collisions"
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    case "$rel" in
      opencode.json | tui.json | .gitignore) continue ;;
    esac
    dest="$(dest_path "$rel")"
    if [ -f "$dest" ] && [ "$(sha256 "$dest")" != "$(sha256 "$(payload_src "$rel")")" ]; then
      printf '%s\n' "${dest#"$PROJECT"/}" >>"$collisions"
    fi
  done <"$TMPROOT/stage_rels.txt"
  n="$(wc -l <"$collisions" | tr -d ' ')"
  if [ "$n" -eq 0 ]; then return 0; fi
  log "$n existing file(s) differ from the harness payload:"
  head -n 10 "$collisions" | while IFS= read -r line; do
    log "  $line"
  done
  if [ "$n" -gt 10 ]; then log "  ... and $((n - 10)) more"; fi
  if [ "$DRY_RUN" = 1 ] || [ "$ASSUME_YES" = 1 ] || [ "$FORCE" = 1 ]; then
    return 0
  fi
  if [ -t 0 ]; then
    printf 'overwrite them? [y/N] '
    read -r reply
    case "$reply" in
      y | Y | yes) return 0 ;;
      *) die "aborted (re-run with --yes to overwrite)" ;;
    esac
  fi
  die "refusing to overwrite $n file(s) without --yes"
}

build_manifest() {
  if [ "$DRY_RUN" = 1 ]; then return 0; fi
  local args prev="" conflicts_csv="" created_csv=""
  if [ -f "$MANIFEST" ]; then prev="$MANIFEST"; fi
  if [ -s "$TMPROOT/conflict_list.txt" ]; then
    conflicts_csv="$(paste -sd, "$TMPROOT/conflict_list.txt")"
  fi
  if [ -s "$TMPROOT/created_list.txt" ]; then
    created_csv="$(paste -sd, "$TMPROOT/created_list.txt")"
  fi
  args=(manifest-build --out "$MANIFEST.tmp" --version "$VERSION" --ref "$REF" \
    --agents-file "$AGENTS_FILE" --merged "$MERGED_FILES" --tsv "$MANIFEST_TSV" \
    --conflicts "$conflicts_csv" --created "$created_csv")
  if [ -n "$prev" ]; then args+=(--previous "$prev"); fi
  mkdir -p "$(dirname "$MANIFEST")"
  node "$LIB" "${args[@]}"
  mv "$MANIFEST.tmp" "$MANIFEST"
}

store_cache() {
  if [ "$DRY_RUN" = 1 ]; then return 0; fi
  local cache_root="$STATE/cache" d
  rm -rf "${cache_root:?}/$VERSION"
  mkdir -p "$cache_root/$VERSION"
  cp -R "$STAGE/harness/." "$cache_root/$VERSION/"
  if [ -f "$STAGE/loopwright.sh" ]; then
    cp "$STAGE/loopwright.sh" "$cache_root/$VERSION/loopwright.sh"
  fi
  for d in "$cache_root"/*; do
    if [ -d "$d" ] && [ "$(basename "$d")" != "$VERSION" ]; then
      rm -rf "$d"
    fi
  done
  BASE_DIR="$cache_root/$VERSION"
}

deps_needed() {
  local pkg="$PROJECT/.opencode/package.json"
  if [ ! -f "$pkg" ]; then return 1; fi
  if [ ! -d "$PROJECT/.opencode/node_modules/@opencode-ai/plugin" ]; then return 0; fi
  if [ -n "$BASE_DIR" ] && [ -f "$BASE_DIR/.opencode/package.json" ]; then
    if [ "$(sha256 "$BASE_DIR/.opencode/package.json")" != "$(sha256 "$pkg")" ]; then
      return 0
    fi
  fi
  return 1
}

run_deps() {
  if [ "$DRY_RUN" = 1 ] || [ "$NO_DEPS" = 1 ]; then return 0; fi
  if [ ! -f "$PROJECT/.opencode/package.json" ]; then return 0; fi
  if ! deps_needed; then return 0; fi
  need npm
  local out rc=0
  out="$(cd "$PROJECT/.opencode" && npm install --no-audit --no-fund 2>&1)" || rc=$?
  if [ "$rc" -ne 0 ]; then
    log "$out"
    add_finding ERROR deps-install "npm install in .opencode/ failed" \
      "run manually: cd .opencode && npm install"
  else
    record_action "npm install (.opencode)"
  fi
}

print_actions() {
  if [ -s "$ACTIONS_LOG" ]; then
    log "changes:"
    while IFS= read -r line; do
      log "  $line"
    done <"$ACTIONS_LOG"
  fi
}

print_changelog() {
  local old="$1" section
  if [ ! -f "$STAGE/CHANGELOG.md" ]; then return 0; fi
  if [ "$old" = "$REF" ]; then return 0; fi
  section="$(awk -v v="$REF" '
    index($0, "## [" v "]") == 1 {f = 1; print; next}
    f && /^## \[/ {f = 0}
    f {print}
  ' "$STAGE/CHANGELOG.md")"
  if [ -n "$section" ]; then
    log ""
    log "release notes for $REF:"
    printf '%s\n' "$section" | while IFS= read -r line; do
      log "  $line"
    done
  fi
}

guard_self_install() {
  if git -C "$PROJECT" remote get-url origin 2>/dev/null | grep -qi "github.com/$OWNER/$REPO"; then
    die "refusing to install into the loopwright repository itself"
  fi
  if [ -f "$PROJECT/harness/.opencode/plugins/shared.ts" ] && [ -f "$PROJECT/integration-analysis.md" ]; then
    die "target already contains harness/ — refusing a nested install (is this a loopwright checkout?)"
  fi
}

run_doctor() {
  local installed latest out err cfg
  LIB="$(find_lib || true)"
  if [ -z "$LIB" ]; then
    add_finding ERROR installer-lib "$LIB_REL: installer library is missing" \
      "restore it: re-run install/update from a clean payload"
    emit_report
    return 1
  fi
  installed="$(manifest_get version)"
  if ! command -v git >/dev/null 2>&1; then
    add_finding ERROR toolchain-git "git not found on PATH" "install git"
  fi
  if command -v node >/dev/null 2>&1; then
    local nv nmajor
    nv="$(node --version | tr -d 'v')"
    nmajor="${nv%%.*}"
    if [ "$nmajor" -lt 20 ]; then
      add_finding ERROR node-old "node $nv is older than the required 20+" "upgrade node"
    fi
  else
    add_finding ERROR node-missing "node not found on PATH" "install node 20+"
  fi
  if ! command -v npm >/dev/null 2>&1; then
    add_finding WARN npm-missing "npm not found on PATH" "needed for loopwright.sh fix"
  fi
  if [ "$NO_OPENCODE" = 0 ]; then
    if command -v opencode >/dev/null 2>&1; then
      local ov
      ov="$(opencode --version 2>/dev/null || printf 'unknown')"
      case "$ov" in
        [0-9]*)
          if version_gt "1.18.0" "$ov"; then
            add_finding WARN opencode-old "opencode $ov predates 1.18" "upgrade opencode"
          fi
          ;;
      esac
    else
      add_finding ERROR opencode-missing "opencode not found on PATH" "install opencode"
    fi
  fi
  node "$LIB" verify --manifest "$MANIFEST" --root "$PROJECT" >>"$FINDINGS"
  node "$LIB" expected --root "$PROJECT" >>"$FINDINGS"
  node "$LIB" deps-check --root "$PROJECT" >>"$FINDINGS"
  if [ -n "$BASE_DIR" ]; then
    if [ -f "$BASE_DIR/opencode.json" ]; then
      node "$LIB" check-harness-keys --file "$PROJECT/opencode.json" \
        --theirs "$BASE_DIR/opencode.json" >>"$FINDINGS"
    fi
    if [ -f "$BASE_DIR/tui.json" ]; then
      node "$LIB" check-harness-keys --file "$PROJECT/tui.json" \
        --theirs "$BASE_DIR/tui.json" >>"$FINDINGS"
    fi
  fi
  for cfg in opencode.json tui.json .opencode/package.json; do
    if [ -f "$PROJECT/$cfg" ]; then
      err=""
      if ! err="$(node "$LIB" validate "$PROJECT/$cfg" 2>&1)"; then
        add_finding ERROR config-invalid "$cfg: invalid JSON/JSONC" "${err:-parse failed}"
      fi
    fi
  done
  if [ "$NO_OPENCODE" = 0 ] && command -v opencode >/dev/null 2>&1; then
    if out="$(cd "$PROJECT" && opencode agent list 2>&1)"; then
      if ! grep -q orchestrator <<<"$out"; then
        add_finding ERROR agents-missing "opencode agent list does not show harness agents" \
          "check plugin load: opencode agent list"
      fi
    else
      add_finding ERROR plugin-load "opencode agent list failed" "${out:0:200}"
    fi
  fi
  if git -C "$PROJECT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    out="$(git -C "$PROJECT" ls-files -ci --exclude-standard 2>/dev/null | head -n 5 || true)"
    if [ -n "$out" ]; then
      local n_ignored
      n_ignored="$(git -C "$PROJECT" ls-files -ci --exclude-standard | wc -l | tr -d ' ')"
      add_finding WARN tracked-ignored "$n_ignored tracked file(s) match gitignore rules" \
        "git rm --cached <file> — first: $(head -n 1 <<<"$out")"
    fi
    out="$(git -C "$PROJECT" ls-files | grep -E '(^|/)\.env(\.|$)|(^|/)[^/]+\.(pem|key)$|(^|/)secrets/' | head -n 5 || true)"
    if [ -n "$out" ]; then
      add_finding ERROR secret-tracked "secret file(s) tracked by git: $(head -n 1 <<<"$out")" \
        "git rm --cached <file>; rotate the secret"
    fi
  else
    add_finding WARN git-repo "project is not a git repository" \
      "the worktree workflow (lpwr-propose) needs git"
  fi
  if [ "$OFFLINE" = 0 ] && [ -n "$installed" ]; then
    latest="$(latest_tag || true)"
    if [ -n "$latest" ]; then
      if version_gt "$latest" "$installed"; then
        add_finding INFO update-available \
          "installed $installed; latest is $latest" "run: loopwright.sh update"
      fi
    fi
  fi
  emit_report
  if [ "$(count_level ERROR)" -gt 0 ] || [ "$(count_level WARN)" -gt 0 ] ||
    [ "$(count_level SUGGEST)" -gt 0 ]; then
    return 1
  fi
  return 0
}

print_next_steps() {
  log ""
  log "next steps:"
  log "  1. restart opencode to load the harness"
  log "  2. lpwr-setup      — machine checks (deps, env, tool surface)"
  log "  3. lpwr-install    — materialize docs/ foundation from templates"
  log "  4. lpwr-onboard    — fill in project context + constitution"
  log "manage: ./loopwright.sh doctor | update | fix"
}

set_base_dir() {
  local prev="$1"
  BASE_DIR="$STATE/cache/$prev"
  if [ ! -d "$BASE_DIR" ]; then BASE_DIR=""; fi
}

cmd_install() {
  need node
  guard_self_install
  if [ -f "$MANIFEST" ] && [ "$FORCE" = 0 ]; then
    die "already installed (version $(manifest_get version)) — run: loopwright.sh update (or install --force)"
  fi
  REF="$(resolve_version)"
  validate_ref "$REF"
  VERSION="$REF"
  if [ -f "$MANIFEST" ]; then
    AGENTS_FILE="$(manifest_get agents_file)"
    [ -n "$AGENTS_FILE" ] || AGENTS_FILE="AGENTS.md"
    set_base_dir "$(manifest_get version)"
  elif [ -f "$PROJECT/AGENTS.md" ]; then
    AGENTS_FILE="AGENTS.lpwr.md"
  fi
  local mode="install"
  if [ -f "$MANIFEST" ] && [ -n "$BASE_DIR" ]; then mode="update"; fi
  prepare_stage
  make_stage_list
  LIB="$(find_lib || true)"
  if [ -z "$LIB" ]; then die "installer library not found in payload ($LIB_REL)"; fi
  if [ "$mode" = "install" ]; then confirm_collisions; fi
  BACKUP_DIR="$STATE/backups/pre-install-$(date +%Y%m%d-%H%M%S)"
  engine "$mode"
  print_actions
  if [ "$DRY_RUN" = 1 ]; then
    if [ -s "$FINDINGS" ]; then emit_report; fi
    log "dry-run: nothing written"
    if [ "$(count_level ERROR)" -gt 0 ]; then return 1; fi
    return 0
  fi
  run_deps
  build_manifest
  store_cache
  run_doctor || true
  print_next_steps
  log ""
  log "installed loopwright $VERSION into $PROJECT"
  if ! soft_rc; then return 1; fi
  return 0
}

cmd_update() {
  need node
  need git
  [ -f "$MANIFEST" ] || die "not installed in $PROJECT — run: loopwright.sh install"
  AGENTS_FILE="$(manifest_get agents_file)"
  [ -n "$AGENTS_FILE" ] || AGENTS_FILE="AGENTS.md"
  local prev
  prev="$(manifest_get version)"
  REF="$(resolve_version)"
  validate_ref "$REF"
  VERSION="$REF"
  set_base_dir "$prev"
  if [ -z "$BASE_DIR" ]; then
    warn "no cached base for $prev — updating without a 3-way base (local edits are backed up)"
  fi
  log "updating $prev -> $VERSION"
  prepare_stage
  make_stage_list
  LIB="$(find_lib || true)"
  if [ -z "$LIB" ]; then die "installer library not found in payload ($LIB_REL)"; fi
  BACKUP_DIR="$STATE/backups/pre-update-$(date +%Y%m%d-%H%M%S)"
  engine update
  print_actions
  if [ "$DRY_RUN" = 1 ]; then
    emit_report
    if [ "$(count_level ERROR)" -gt 0 ]; then return 1; fi
    log "dry-run: nothing written"
    return 0
  fi
  run_deps
  build_manifest
  store_cache
  print_changelog "$prev"
  run_doctor || true
  if ! soft_rc; then return 1; fi
  return 0
}

cmd_doctor() {
  if [ ! -f "$MANIFEST" ]; then
    printf 'not installed in %s — run: loopwright.sh install\n' "$PROJECT" >&2
    return 2
  fi
  AGENTS_FILE="$(manifest_get agents_file)"
  [ -n "$AGENTS_FILE" ] || AGENTS_FILE="AGENTS.md"
  set_base_dir "$(manifest_get version)"
  local rc=0
  run_doctor || rc=$?
  return "$rc"
}

bootstrap_restore() {
  local rel dest
  while IFS=$'\x1f' read -r rel _sha _state _extra; do
    [ -n "$rel" ] || continue
    dest="$(dest_path "$rel")"
    if [ -f "$dest" ]; then continue; fi
    if [ -f "$BASE_DIR/$rel" ]; then
      if [ "$DRY_RUN" = 1 ]; then
        record_action "restored $rel (missing)"
      else
        mkdir -p "$(dirname "$dest")"
        cp "$BASE_DIR/$rel" "$dest"
        record_action "restored $rel (missing)"
      fi
    fi
  done < <(manifest_files "$MANIFEST")
}

cmd_fix() {
  need node
  [ -f "$MANIFEST" ] || die "not installed in $PROJECT — run: loopwright.sh install"
  AGENTS_FILE="$(manifest_get agents_file)"
  [ -n "$AGENTS_FILE" ] || AGENTS_FILE="AGENTS.md"
  local prev
  prev="$(manifest_get version)"
  VERSION="$prev"
  REF="$prev"
  BASE_DIR="$STATE/cache/$prev"
  if [ ! -d "$BASE_DIR" ]; then
    warn "cache for $prev missing — fetching payload $prev"
    prepare_stage
    mkdir -p "$BASE_DIR"
    cp -R "$STAGE/harness/." "$BASE_DIR/"
    if [ -f "$STAGE/loopwright.sh" ]; then cp "$STAGE/loopwright.sh" "$BASE_DIR/"; fi
  fi
  BACKUP_DIR="$STATE/backups/fix-$(date +%Y%m%d-%H%M%S)"
  bootstrap_restore
  LIB="$(find_lib || true)"
  if [ -z "$LIB" ]; then die "installer library not found (expected $PROJECT/$LIB_REL)"; fi
  local verify_out level code message hint rel dest
  verify_out="$(node "$LIB" verify --manifest "$MANIFEST" --root "$PROJECT")"
  while IFS=$'\t' read -r level code message hint; do
    [ -n "$level" ] || continue
    if [ "$code" != "drifted" ]; then continue; fi
    rel="${message%%:*}"
    rel="${rel# }"
    if [ "$rel" = "$AGENTS_FILE" ] && [ "$AGENTS_FILE" != "AGENTS.md" ]; then
      rel="AGENTS.md"
    fi
    dest="$(dest_path "$rel")"
    if [ -f "$BASE_DIR/$rel" ]; then
      if [ "$DRY_RUN" = 1 ]; then
        record_action "restored drifted $rel"
      else
        backup_file "$dest"
        cp "$BASE_DIR/$rel" "$dest"
        record_action "restored drifted $rel"
      fi
    fi
  done <<<"$verify_out"
  while IFS=$'\x1f' read -r rel _sha state _extra; do
    [ -n "$rel" ] || continue
    if [ "$state" != "conflict" ]; then continue; fi
    dest="$(dest_path "$rel")"
    if [ ! -f "$dest" ]; then continue; fi
    if grep -q '^<<<<<<< ' "$dest"; then continue; fi
    if [ "$DRY_RUN" = 1 ]; then
      record_action "recorded conflict resolution $rel"
    else
      node "$LIB" manifest-set --manifest "$MANIFEST" --rel "$rel" \
        --sha "$(sha256 "$dest")"
      record_action "recorded conflict resolution $rel"
    fi
  done < <(manifest_files "$MANIFEST")
  local f heal_out
  for f in opencode.json tui.json; do
    if [ ! -f "$PROJECT/$f" ] || [ ! -f "$BASE_DIR/$f" ]; then continue; fi
    heal_out="$(node "$LIB" check-harness-keys --file "$PROJECT/$f" --theirs "$BASE_DIR/$f")"
    if [ -n "$heal_out" ]; then
      run_merge_config "$BASE_DIR/$f" "$PROJECT/$f" "$BASE_DIR/$f" force
      record_action "healed $f"
    fi
  done
  if [ -f "$BASE_DIR/.gitignore" ]; then
    local gout="$TMPROOT/fixed-gitignore"
    if [ ! -f "$PROJECT/.gitignore" ]; then
      if [ "$DRY_RUN" = 1 ]; then
        record_action "restored .gitignore"
      else
        cp "$BASE_DIR/.gitignore" "$PROJECT/.gitignore"
        record_action "restored .gitignore"
      fi
    else
      node "$LIB" union-gitignore --theirs "$BASE_DIR/.gitignore" \
        --ours "$PROJECT/.gitignore" --out "$gout"
      if [ "$(sha256 "$PROJECT/.gitignore")" != "$(sha256 "$gout")" ]; then
        if [ "$DRY_RUN" = 1 ]; then
          record_action "completed .gitignore"
        else
          cp "$gout" "$PROJECT/.gitignore"
          record_action "completed .gitignore"
        fi
      fi
    fi
  fi
  if [ ! -f "$PROJECT/.opencode/package.json" ] && [ -f "$BASE_DIR/.opencode/package.json" ]; then
    if [ "$DRY_RUN" = 1 ]; then
      record_action "restored .opencode/package.json"
    else
      mkdir -p "$PROJECT/.opencode"
      cp "$BASE_DIR/.opencode/package.json" "$PROJECT/.opencode/package.json"
      record_action "restored .opencode/package.json"
    fi
  fi
  if [ -f "$PROJECT/.opencode/package.json" ]; then
    local deps_out
    deps_out="$(node "$LIB" deps-check --root "$PROJECT")"
    if grep -qE $'\t(deps-manifest|deps-declared)\t' <<<"$deps_out"; then
      if [ -f "$BASE_DIR/.opencode/package.json" ]; then
        if [ "$DRY_RUN" = 1 ]; then
          record_action "healed .opencode/package.json dependencies"
        else
          node "$LIB" deps-heal --file "$PROJECT/.opencode/package.json" \
            --from "$BASE_DIR/.opencode/package.json"
          record_action "healed .opencode/package.json dependencies"
        fi
      fi
    fi
  fi
  print_actions
  if [ "$DRY_RUN" = 1 ]; then
    log "dry-run: nothing written"
    return 0
  fi
  run_deps
  run_doctor || true
  if ! soft_rc; then return 1; fi
  return 0
}

cmd_status() {
  if [ ! -f "$MANIFEST" ]; then
    printf 'not installed in %s — run: loopwright.sh install\n' "$PROJECT" >&2
    return 2
  fi
  local installed latest n_missing=0 n_drifted=0 n_conflict=0 rel sha state dest
  installed="$(manifest_get version)"
  AGENTS_FILE="$(manifest_get agents_file)"
  [ -n "$AGENTS_FILE" ] || AGENTS_FILE="AGENTS.md"
  while IFS=$'\x1f' read -r rel sha state _extra; do
    if [ "$state" = "conflict" ]; then
      n_conflict=$((n_conflict + 1))
      continue
    fi
    dest="$(dest_path "$rel")"
    if [ ! -f "$dest" ]; then
      n_missing=$((n_missing + 1))
    elif [ "$(sha256 "$dest")" != "$sha" ]; then
      n_drifted=$((n_drifted + 1))
    fi
  done < <(manifest_files "$MANIFEST")
  log "project:    $PROJECT"
  log "version:    $installed"
  log "agents:     $AGENTS_FILE"
  log "files:      $(manifest_files "$MANIFEST" | wc -l | tr -d ' ') managed"
  log "missing:    $n_missing"
  log "drifted:    $n_drifted"
  log "conflicts:  $n_conflict"
  if [ -d "$STATE/cache/$installed" ]; then
    log "cache:      yes"
  else
    log "cache:      no (fix will re-fetch)"
  fi
  if [ "$OFFLINE" = 0 ] && [ -n "$installed" ]; then
    latest="$(latest_tag || true)"
    if [ -n "$latest" ]; then
      if version_gt "$latest" "$installed"; then
        log "latest:     $latest (update available)"
      else
        log "latest:     $latest (up to date)"
      fi
    else
      log "latest:     unknown (offline or unauthenticated)"
    fi
  fi
  if [ "$n_missing" -gt 0 ] || [ "$n_drifted" -gt 0 ] || [ "$n_conflict" -gt 0 ]; then
    log "run:        ./loopwright.sh doctor"
  fi
}

cmd_uninstall() {
  [ -f "$MANIFEST" ] || die "not installed in $PROJECT"
  AGENTS_FILE="$(manifest_get agents_file)"
  [ -n "$AGENTS_FILE" ] || AGENTS_FILE="AGENTS.md"
  local rel sha dest first_backup created
  local -a modified=()
  while IFS=$'\x1f' read -r rel sha _state created; do
    dest="$(dest_path "$rel")"
    if [ ! -f "$dest" ]; then continue; fi
    if [ "$(sha256 "$dest")" != "$sha" ]; then
      modified+=("${dest#"$PROJECT"/}")
      continue
    fi
    if [ "$DRY_RUN" = 1 ]; then
      printf 'dry-run: remove %s\n' "${dest#"$PROJECT"/}"
      continue
    fi
    case "$rel" in
      opencode.json | tui.json | .gitignore)
        if [ "$created" = "created" ]; then
          rm "$dest"
          continue
        fi
        first_backup="$(find "$STATE/backups" -type f -path "*/${dest#"$PROJECT"/}" 2>/dev/null | sort | head -n 1 || true)"
        if [ -n "$first_backup" ]; then
          cp "$first_backup" "$dest"
          log "restored original ${dest#"$PROJECT"/} from backup"
        else
          log "kept ${dest#"$PROJECT"/} (no pre-install backup found)"
        fi
        ;;
      *)
        rm "$dest"
        ;;
    esac
  done < <(manifest_files "$MANIFEST")
  if [ "${#modified[@]}" -gt 0 ]; then
    log "kept locally modified file(s):"
    local m
    for m in "${modified[@]}"; do
      log "  $m"
    done
  fi
  if [ "$DRY_RUN" = 1 ]; then
    log "dry-run: nothing removed"
    return 0
  fi
  rm -rf "$STATE/cache"
  rm -f "$MANIFEST"
  if [ -d "$STATE/backups" ] && [ -n "$(ls -A "$STATE/backups" 2>/dev/null)" ]; then
    log "backups kept at $STATE/backups"
  else
    rm -rf "$STATE"
  fi
  log "uninstalled harness-owned files from $PROJECT"
  log "project files (docs/, config, lessons, specs) left untouched"
}

case "$SUBCMD" in
  install) cmd_install ;;
  update) cmd_update ;;
  doctor) cmd_doctor ;;
  fix) cmd_fix ;;
  status) cmd_status ;;
  uninstall) cmd_uninstall ;;
  version)
    printf 'loopwright.sh %s\n' "$SCRIPT_VERSION"
    ;;
  help) usage ;;
  *)
    usage >&2
    die "unknown command: $SUBCMD"
    ;;
esac
