#!/bin/bash
echo "$1" | sudo -S systemctl restart spa-server.service
systemctl status spa-server.service --no-pager
