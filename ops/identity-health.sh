#!/bin/bash
set -e
exec 3<>/dev/tcp/127.0.0.1/9000
printf 'GET /auth/health/ready HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3
read -r response <&3
[[ "$response" == *" 200 "* ]]
