#!/bin/bash
set -e
check() {
  exec 3<>/dev/tcp/127.0.0.1/$1
  printf 'GET %s HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' "$2" >&3
  read -r response <&3
  exec 3>&-
  [[ "$response" == *" 200 "* ]]
}
check 9000 /auth/health/ready
# The gateway must wait for the imported realm and its signing keys, not only the process.
check 8080 /auth/realms/${OIDC_REALM:-prooflane}/protocol/openid-connect/certs
