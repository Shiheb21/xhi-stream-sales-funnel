#!/bin/bash
# XHI Stream Sales Funnel — Local Tunnel Script
# Exposes localhost:3000 (API Gateway) to public HTTPs for Meta Webhooks

if ! command -v lt &> /dev/null; then
    echo "Installing localtunnel globally via npm..."
    npm install -g localtunnel
fi

echo "--- 🚀 XHI TUNNEL INITIATED ---"
echo "Listening to API Gateway Localhost Port 3000..."
echo "Use the generated URL below in your Meta/TikTok App Webhook Settings:"

# Launch local tunnel connected to port 3000 mapping internally to Docker
lt --port 3000 --subdomain xhi-meta-webhook-dev-001
