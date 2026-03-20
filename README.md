# XHI Stream Sales Funnel 🚀

High-throughput live-stream lead ingestion funnel explicitly tuned to handle TikTok/Meta API comment blasts across Redis Streams, orchestrated batching in PostgreSQL, and real-time Socket.IO WebSocket sync for the React `.speckit` UI Mission Control.

---

## 🚨 Final Speckit Docs: Operations & Recovery 🚨

### 1. View the Dead-Letter Queue (DLQ) in Redis
If structured chunks fail to insert into PostgreSQL, the isolated batch is captured natively by the DLQ. You can inspect failing chunks without dropping valid arrays:

To view the DLQ length and dump its current failed payloads:
```bash
docker exec -it xhi-prod-redis-master redis-cli
> SCARD leads_dlq
> SMEMBERS leads_dlq
```
*Note: SMEMBERS parses out the raw JSON stringified array of leads that caused the Prisma P2021/P2002 failures.*

### 2. Manual Stream Recovery (If Auto-Monitor is paused)
If the Stream Monitor is paused, returning 0kbps offline states, or fails to execute the auto-watchdog loop, you can manually force the recovery cycle hitting the launcher endpoint:

```bash
# Trigger the emergency wrapper reload
curl -X POST http://localhost/api/launch \
  -H "Content-Type: application/json" \
  -d '{"id":"STREAM_AUTUMN_001", "streamUrl":"rtmp://recovered-stream-url"}'
```
*The NGINX rate-limiter protects this endpoint, allowing max 1req/sec globally. The web clients will automatically reconnect their Socket event loops once the monitor resurrects the FFMEPG mock logic.*

---

### Load Simulation Guarantee
The `stress-test.ts` injects 15,000 blended noise-comments. `Prisma.createMany` handles 100-500 buffering chunk logic inside the `lead-processor` yielding ~0 dropped valid phone combinations whilst isolating `invalid` inputs successfully to prevent SQL locks. 
