#!/bin/bash
docker ps --format "table {{.Names}}\t{{.Ports}}"
