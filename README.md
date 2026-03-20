# XHI Stream Sales Funnel 🚀

High-throughput live-stream lead ingestion funnel explicitly tuned to handle TikTok/Meta API comment blasts across Redis Streams, orchestrated batching in PostgreSQL, and real-time Socket.IO WebSocket sync for the React `.speckit` UI Mission Control.

---

## 🚨 Emergency Recovery Procedure 🚨

### 1. Redis Buffer OOM / Overflow
If the Lead Processor crashes and thousands of comments accumulate, Redis memory might peak.
**Action (Flush Buffer, Save DB):**
Do not drop Postgres. Run the following to surgically clear the `comment_stream` without destroying valid persistent DB data:
```bash
docker exec -it xhi-prod-redis-master redis-cli
> XTRIM comment_stream MAXLEN 0
> DEL leads_dlq
```
*Wait 30s. The stream-monitor will auto-reconnect listeners.*

### 2. Ads Tracking Sync Failures (Rotating Meta Tokens)
If CPL stalls or Meta Graph API rejects polling, your token is dead.
1. Generate new Long-Lived User Access token in Meta Business Manager.
2. Edit your base `.env` file:
```env
META_ACCESS_TOKEN=EAAG...new_token
TIKTOK_ACCESS_TOKEN=...
```
3. Restart identical service ONLY (does not drop active streams or websockets):
```bash
docker-compose -f production.docker-compose.yml up -d ads-tracking
```

### 3. Stream Bitrate 0kbps / Container Blackhole
If the OBS wrapper completely fails and the autonomous Self-Recovery watchdog is blinded.
**Manual override procedure:**
```bash
docker restart xhi-stream-monitor
```
The monitor parses `/api/launch` endpoints. Web clients will automatically reconnect their Socket event loops once the monitor resurrects the FFMEPG mock logic.
