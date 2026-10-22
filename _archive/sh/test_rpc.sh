#!/bin/bash
curl -i -s -X POST 'http://127.0.0.1:80/rest/v1/rpc/search_available_profiles' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg0MjUzNTAxLCJleHAiOjIwOTk2MTM1MDF9.J6epEjJZoyDL5GM_PNLoh3P2j18CCP4WeLrfAejCaew' \
  -H 'Content-Type: application/json' \
  -d '{"search_term":"مس","limit_count":2}'
