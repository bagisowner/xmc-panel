#!/usr/bin/env bash
# Root redirect to public install script or direct execution
exec bash <(curl -fsSL https://ais-dev-7a7idwpopqsbrjzj22ixgt-228418918684.asia-east1.run.app/install.sh) "$@"
