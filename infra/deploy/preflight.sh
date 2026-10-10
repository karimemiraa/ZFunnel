#!/usr/bin/env bash
# READ-ONLY server inspection. Changes nothing. Run this first on any server that
# already hosts other apps, and review the output before deploying.
set -uo pipefail

ok() { printf "  \033[32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$*"; }
bad() { printf "  \033[31m✗\033[0m %s\n" "$*"; }
section() { printf "\n\033[1m%s\033[0m\n" "$*"; }

section "System"
echo "  Host: $(hostname)  ·  OS: $(. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME")  ·  Arch: $(uname -m)"
echo "  CPUs: $(nproc)  ·  Memory: $(free -h | awk '/Mem:/ {print $2" total, "$7" available"}')"
echo "  Disk (/): $(df -h / | awk 'NR==2 {print $4" free of "$2}')"
mem_mb=$(free -m | awk '/Mem:/ {print $7}')
[ "${mem_mb:-0}" -lt 1500 ] && warn "Less than 1.5 GB RAM available: builds may be slow; consider building images elsewhere." || ok "Enough memory available"

section "Docker"
if command -v docker >/dev/null; then
  ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"
  docker compose version >/dev/null 2>&1 && ok "Docker Compose $(docker compose version --short)" || bad "Docker Compose plugin missing"
  if docker info >/dev/null 2>&1; then
    echo "  Running containers (these will NOT be touched):"
    docker ps --format '    {{.Names}}  ({{.Image}})  {{.Ports}}'
    docker ps -a --format '{{.Names}}' | grep -q '^zfunnel-' && warn "Existing zfunnel-* containers found (a previous ZFunnel install)." || ok "No existing zfunnel containers"
    docker network ls --format '{{.Name}}' | grep -qx zfunnel_internal && warn "Network zfunnel_internal already exists (previous install)." || ok "Network name zfunnel_internal is free"
  else
    warn "Cannot talk to the Docker daemon (not running, or run this with sudo / as a docker-group user). Container checks skipped."
  fi
else
  bad "Docker is not installed"
fi

section "Ports"
if command -v ss >/dev/null || command -v netstat >/dev/null; then
  listening() { (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | awk -v p=":$1" '$4 ~ p"$" {print $NF}' | head -1; }
  in_use() { (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}' | grep -qE "[:.]$1$"; }
  for p in 80 443; do
    if in_use "$p"; then warn "Port $p is already in use by: $(listening "$p" || echo unknown) → see 'Sharing ports' in docs/DEPLOYMENT.md"; else ok "Port $p is free"; fi
  done
else
  warn "Neither ss nor netstat is installed: cannot check ports 80/443. Install iproute2 and re-run."
fi

section "Firewall"
if command -v iptables >/dev/null && sudo -n true 2>/dev/null; then
  sudo iptables -S INPUT 2>/dev/null | grep -qE 'REJECT|DROP' && warn "iptables has REJECT/DROP rules (common on Oracle images). Make sure 80/443 are allowed." || ok "No blocking iptables INPUT rules found"
else
  warn "Could not inspect iptables (needs sudo). On Oracle Cloud also open 80/443 in the VCN security list."
fi

section "Summary"
echo "  Nothing was changed. If ports 80/443 are taken, set CADDY_HTTP_PORT/CADDY_HTTPS_PORT in infra/deploy/.env."
