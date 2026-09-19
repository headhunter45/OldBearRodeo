#!/usr/bin/env bash
# ==============================================================================
# Old Bear Rodeo - Production Container Build & CI Publish Script
# Sourced from single source of truth: VERSION file in repository root
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# 1. Read version from single source of truth (VERSION file in repo root)
APP_VERSION=""
if [ -f "${ROOT_DIR}/VERSION" ]; then
  APP_VERSION="$(tr -d ' \r\n' < "${ROOT_DIR}/VERSION")"
fi
if [ -z "${APP_VERSION}" ]; then
  APP_VERSION="0.1.0-alpha5"
fi

# 2. Get short git commit hash
GIT_COMMIT_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo "dev")"

# Default configuration (can be overridden via CLI args or environment variables)
IMAGE_REGISTRY="${IMAGE_REGISTRY:-registry.tomusan.com/}"
if [ -n "${IMAGE_REGISTRY}" ] && [[ "${IMAGE_REGISTRY}" != */ ]]; then
  IMAGE_REGISTRY="${IMAGE_REGISTRY}/"
fi

IMAGE_TAG="${IMAGE_TAG:-${APP_VERSION}}"
DO_PUSH=false
RUN_TESTS=false

# Parse command line options
while [[ $# -gt 0 ]]; do
  case "$1" in
    --registry)
      IMAGE_REGISTRY="$2"
      if [ -n "${IMAGE_REGISTRY}" ] && [[ "${IMAGE_REGISTRY}" != */ ]]; then
        IMAGE_REGISTRY="${IMAGE_REGISTRY}/"
      fi
      shift 2
      ;;
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --push)
      DO_PUSH=true
      shift
      ;;
    --test)
      RUN_TESTS=true
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --registry <URL>   Container registry prefix (default: ${IMAGE_REGISTRY})"
      echo "  --tag <TAG>        Container image tag (default: ${IMAGE_TAG} from VERSION file)"
      echo "  --push             Push container images to registry after building"
      echo "  --test             Run test suites before building images"
      echo "  -h, --help         Show this help message"
      echo ""
      echo "Version info:"
      echo "  VERSION file      : ${APP_VERSION}"
      echo "  Git commit hash   : ${GIT_COMMIT_SHORT}"
      echo ""
      echo "Examples:"
      echo "  $0"
      echo "  $0 --push"
      echo "  $0 --registry ghcr.io/myorg/ --tag v1.0.0 --push"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "======================================================================"
echo " Old Bear Rodeo - Production Container Build"
echo "======================================================================"
echo " Application Ver : ${APP_VERSION} (from VERSION)"
echo " Git Commit Hash : ${GIT_COMMIT_SHORT}"
echo " Primary Tag     : ${IMAGE_TAG}"
echo " Registry Prefix : ${IMAGE_REGISTRY:-<local docker>}"
echo " Push to Registry: ${DO_PUSH}"
echo " Project Root    : ${ROOT_DIR}"
echo "======================================================================"

# Optional test run
if [ "${RUN_TESTS}" = true ]; then
  echo ""
  echo "==> Running automated test suites..."
  npm test
fi

CLIENT_IMAGE="${IMAGE_REGISTRY}oldbear_client:${IMAGE_TAG}"
CLIENT_IMAGE_COMMIT="${IMAGE_REGISTRY}oldbear_client:${GIT_COMMIT_SHORT}"
CLIENT_IMAGE_LATEST="${IMAGE_REGISTRY}oldbear_client:latest"

SERVER_IMAGE="${IMAGE_REGISTRY}oldbear_server:${IMAGE_TAG}"
SERVER_IMAGE_COMMIT="${IMAGE_REGISTRY}oldbear_server:${GIT_COMMIT_SHORT}"
SERVER_IMAGE_LATEST="${IMAGE_REGISTRY}oldbear_server:latest"

NGINX_IMAGE="${IMAGE_REGISTRY}oldbear_nginx:${IMAGE_TAG}"
NGINX_IMAGE_COMMIT="${IMAGE_REGISTRY}oldbear_nginx:${GIT_COMMIT_SHORT}"
NGINX_IMAGE_LATEST="${IMAGE_REGISTRY}oldbear_nginx:latest"

echo ""
echo "==> 1/3 Building Client container (${CLIENT_IMAGE})..."
docker build \
  -t "${CLIENT_IMAGE}" \
  -t "${CLIENT_IMAGE_COMMIT}" \
  -t "${CLIENT_IMAGE_LATEST}" \
  -f docker/Dockerfile.client \
  --build-arg CLIENT_PORT=80 \
  --build-arg APP_VERSION="${APP_VERSION}" \
  --build-arg GIT_COMMIT_HASH="${GIT_COMMIT_SHORT}" \
  .

echo ""
echo "==> 2/3 Building Server container (${SERVER_IMAGE})..."
docker build \
  -t "${SERVER_IMAGE}" \
  -t "${SERVER_IMAGE_COMMIT}" \
  -t "${SERVER_IMAGE_LATEST}" \
  -f docker/Dockerfile.server \
  --build-arg SERVER_PORT=3001 \
  --build-arg APP_VERSION="${APP_VERSION}" \
  --build-arg GIT_COMMIT_HASH="${GIT_COMMIT_SHORT}" \
  .

echo ""
echo "==> 3/3 Building Nginx proxy container (${NGINX_IMAGE})..."
docker build \
  -t "${NGINX_IMAGE}" \
  -t "${NGINX_IMAGE_COMMIT}" \
  -t "${NGINX_IMAGE_LATEST}" \
  -f docker/Dockerfile.nginx \
  .

echo ""
echo "======================================================================"
echo " Build Completed Successfully!"
echo " Images built:"
echo "   - ${CLIENT_IMAGE}, ${CLIENT_IMAGE_COMMIT}, ${CLIENT_IMAGE_LATEST}"
echo "   - ${SERVER_IMAGE}, ${SERVER_IMAGE_COMMIT}, ${SERVER_IMAGE_LATEST}"
echo "   - ${NGINX_IMAGE}, ${NGINX_IMAGE_COMMIT}, ${NGINX_IMAGE_LATEST}"
echo "======================================================================"

if [ "${DO_PUSH}" = true ]; then
  echo ""
  echo "==> Pushing images to registry: ${IMAGE_REGISTRY}..."
  docker push "${CLIENT_IMAGE}"
  docker push "${CLIENT_IMAGE_COMMIT}"
  docker push "${CLIENT_IMAGE_LATEST}"
  docker push "${SERVER_IMAGE}"
  docker push "${SERVER_IMAGE_COMMIT}"
  docker push "${SERVER_IMAGE_LATEST}"
  docker push "${NGINX_IMAGE}"
  docker push "${NGINX_IMAGE_COMMIT}"
  docker push "${NGINX_IMAGE_LATEST}"

  echo ""
  echo "======================================================================"
  echo " All images successfully pushed to ${IMAGE_REGISTRY}!"
  echo "======================================================================"
fi
