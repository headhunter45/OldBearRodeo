#!/usr/bin/env bash
# ==============================================================================
# Old Bear Rodeo - Production Container Build & CI Publish Script
# ==============================================================================
set -euo pipefail

# Default configuration (can be overridden via CLI args or environment variables)
IMAGE_REGISTRY="${IMAGE_REGISTRY:-registry.tomusan.com/}"
# Ensure trailing slash if registry is non-empty and doesn't end with slash
if [ -n "${IMAGE_REGISTRY}" ] && [[ "${IMAGE_REGISTRY}" != */ ]]; then
  IMAGE_REGISTRY="${IMAGE_REGISTRY}/"
fi

GIT_COMMIT_SHORT="$(git rev-parse --short HEAD 2>/dev/null || echo "dev")"
IMAGE_TAG="${IMAGE_TAG:-${GIT_COMMIT_SHORT}}"
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
      echo "  --tag <TAG>        Container image tag (default: ${IMAGE_TAG})"
      echo "  --push             Push container images to registry after building"
      echo "  --test             Run test suites before building images"
      echo "  -h, --help         Show this help message"
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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo "======================================================================"
echo " Old Bear Rodeo - Production Container Build"
echo "======================================================================"
echo " Registry Prefix : ${IMAGE_REGISTRY:-<local docker>}"
echo " Image Tag       : ${IMAGE_TAG}"
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
CLIENT_IMAGE_LATEST="${IMAGE_REGISTRY}oldbear_client:latest"
SERVER_IMAGE="${IMAGE_REGISTRY}oldbear_server:${IMAGE_TAG}"
SERVER_IMAGE_LATEST="${IMAGE_REGISTRY}oldbear_server:latest"
NGINX_IMAGE="${IMAGE_REGISTRY}oldbear_nginx:${IMAGE_TAG}"
NGINX_IMAGE_LATEST="${IMAGE_REGISTRY}oldbear_nginx:latest"

echo ""
echo "==> 1/3 Building Client container (${CLIENT_IMAGE})..."
docker build \
  -t "${CLIENT_IMAGE}" \
  -t "${CLIENT_IMAGE_LATEST}" \
  -f docker/Dockerfile.client \
  --build-arg CLIENT_PORT=80 \
  .

echo ""
echo "==> 2/3 Building Server container (${SERVER_IMAGE})..."
docker build \
  -t "${SERVER_IMAGE}" \
  -t "${SERVER_IMAGE_LATEST}" \
  -f docker/Dockerfile.server \
  --build-arg SERVER_PORT=3001 \
  .

echo ""
echo "==> 3/3 Building Nginx proxy container (${NGINX_IMAGE})..."
docker build \
  -t "${NGINX_IMAGE}" \
  -t "${NGINX_IMAGE_LATEST}" \
  -f docker/Dockerfile.nginx \
  .

echo ""
echo "======================================================================"
echo " Build Completed Successfully!"
echo " Images built:"
echo "   - ${CLIENT_IMAGE} (and :latest)"
echo "   - ${SERVER_IMAGE} (and :latest)"
echo "   - ${NGINX_IMAGE} (and :latest)"
echo "======================================================================"

if [ "${DO_PUSH}" = true ]; then
  echo ""
  echo "==> Pushing images to registry: ${IMAGE_REGISTRY}..."
  docker push "${CLIENT_IMAGE}"
  docker push "${CLIENT_IMAGE_LATEST}"
  docker push "${SERVER_IMAGE}"
  docker push "${SERVER_IMAGE_LATEST}"
  docker push "${NGINX_IMAGE}"
  docker push "${NGINX_IMAGE_LATEST}"

  echo ""
  echo "======================================================================"
  echo " All images successfully pushed to ${IMAGE_REGISTRY}!"
  echo "======================================================================"
fi
