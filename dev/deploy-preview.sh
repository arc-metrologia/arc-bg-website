#!/usr/bin/env bash
# Качва текущия commit на скритото preview копие в SuperHosting.bg (вика се от post-commit hook).
# Адресът и SSH достъпът са в dev/.env.deploy (не е в git): PREVIEW_HOST, SSH_*.
# Никога не пише в public_html: целта е ~/$PREVIEW_HOST/public, конфигурацията е в ~/$PREVIEW_HOST/arc-config.php.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/dev/.env.deploy"
[ -f "$ENV_FILE" ] || { echo "deploy-preview: липсва $ENV_FILE, пропускам."; exit 0; }
. "$ENV_FILE"

case "$PREVIEW_HOST" in
    ""|www.arc-bg.com|arc-bg.com|new.arc-bg.com|erp.arc-bg.com|compxyz.arc-bg.com)
        echo "deploy-preview: отказвам да кача в '$PREVIEW_HOST'."; exit 1 ;;
esac
DEST="/home/$SSH_USER/$PREVIEW_HOST/public"
SSH=(ssh -o BatchMode=yes -o LogLevel=ERROR -i "$SSH_KEY" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST")

cd "$ROOT"
# В hook git задава GIT_DIR/GIT_INDEX_FILE, които объркват git worktree
unset GIT_DIR GIT_INDEX_FILE GIT_WORK_TREE
# Качва се точно commit-натото: при некомитнати промени билдът е от чисто копие на HEAD
SRC="$ROOT"
if [ -n "$(git status --porcelain)" ]; then
    echo "deploy-preview: има некомитнати промени, билдвам чисто копие на HEAD."
    WORK="$(mktemp -d)"
    trap 'git -C "$ROOT" worktree remove --force "$WORK/src" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
    git worktree add --detach -q "$WORK/src" HEAD
    (cd "$WORK/src/frontend" && npm ci --silent)
    SRC="$WORK/src"
fi
(cd "$SRC/frontend" && npm run build --silent)

COMMIT="$(git rev-parse --short HEAD)"
echo "deploy-preview: качвам $COMMIT в https://$PREVIEW_HOST ..."
tar -C "$SRC/backend" --exclude='./app/config.php' --exclude='./uploads/20*' -czf - . \
    | "${SSH[@]}" "set -e
        STAGE=\$(mktemp -d ~/tmp/arc-preview.XXXXXX)
        tar -xzf - -C \"\$STAGE\"
        for f in \$(cd \"\$STAGE\" && find . -name '*.php'); do php -l \"\$STAGE/\$f\" >/dev/null || { echo \"PHP грешка: \$f\"; rm -rf \"\$STAGE\"; exit 1; }; done
        printf '\n<IfModule mod_headers.c>\n    Header set X-Robots-Tag \"noindex, nofollow\"\n</IfModule>\n' >> \"\$STAGE/.htaccess\"
        echo '$COMMIT' > \"\$STAGE/build/VERSION\"
        rsync -rlt --delete --exclude='/uploads/20*' --exclude='/cgi-bin' --exclude='/.well-known' \"\$STAGE/\" '$DEST/'
        rm -rf \"\$STAGE\""
echo "deploy-preview: готово, https://$PREVIEW_HOST ($COMMIT)"
