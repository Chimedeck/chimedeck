#!/usr/bin/env bash

set_env_var() {
  local var_name="$1"
  local default_value="$2"
  if [ -z "${!var_name}" ]; then
    export "$1"="$default_value"
  fi
}
