# DEX Orderbook Indexer

A real-time indexer for a decentralized exchange (DEX) orderbook. This service listens to on-chain smart contract events, reconstructs the orderbook state, and provides fast APIs and WebSocket streams for frontend clients. It also aggregates trade data into OHLCV candles for charting.

---

## Overview

This indexer acts as an bridge between on-chain orderbook contracts and off-chain applications. Instead of querying the blockchain directly for every request, it continuously syncs events, maintains structured state, and serves low-latency data to clients.

Key responsibilities:

* Listen to on-chain order and fill events
* Maintain real-time orderbook snapshots
* Stream live updates over WebSockets
* Persist trades and generate OHLCV candles
* Provide REST endpoints for snapshots and health checks

---

## Features

* **Event-driven indexing**
  Subscribes to program logs and parses order lifecycle events (place, fill, partial fill, cancel).

* **Real-time orderbook reconstruction**
  Fetches and decodes market slab accounts to build bid/ask books.

* **WebSocket streaming (Socket.IO)**
  Pushes live order and candle updates to connected clients.

* **Candle aggregation**
  Stores trades in PostgreSQL and generates OHLCV candles (1m, 5m, 1h, 1d).

* **REST API**
  Snapshot endpoints for orderbook and service health.

* **Graceful shutdown & recovery**
  Cleans up subscriptions and connections safely.

---

## Tech Stack

* TypeScript + Node.js
* Solana Web3 + Anchor event parsing
* Express + Socket.IO
* Prisma ORM
* PostgreSQL


## Requirements

* Node.js 18+
* PostgreSQL database
* Access to a Solana RPC endpoint
* Program ID and market public key

---

## Environment Variables

Create a `.env` file in the root directory:

```
RPC_URL=http://127.0.0.1:8899
PROGRAM_ID=<your_program_id>
MARKET_PUBKEY=<your_market_pubkey>
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/indexer
```

---

## Installation

```bash
git clone <repo-url>
cd indexer
npm install
```

### Database setup

```bash
npx prisma migrate deploy
```

(Optional seed)

```bash
npm run seed
```

---

## Running the Indexer

### Development

```bash
npm run dev
```

### Production build

```bash
npm run build
node dist/index.js
```

The server starts with:

* HTTP API: `http://localhost:3001`
* WebSocket: `ws://localhost:3001`

---

## API Endpoints

### Health Check

```
GET /health
```

Returns connection status, slot height, and active clients.

### Orderbook Snapshot

```
GET /orderbook
```

Returns current bid/ask state and market metadata.

---

## WebSocket Events

### Server → Client

* `snapshot` — initial market snapshot
* `order:placed` — new order
* `order:filled` — trade execution
* `order:cancelled` — order cancellation
* `candle:filled` — updated candle data

### Client → Server

* `resolution` — request candle resolution change

---

## Graceful Shutdown

The service handles `SIGINT` and `SIGTERM`:

* Stops event subscriptions
* Closes WebSocket connections
* Cleans up resources safely

---

## Performance Notes

* Uses log subscriptions for low-latency event ingestion
* Parallel slab fetching for faster snapshots
* Database upserts prevent duplicate trades
* Socket.IO broadcasting scales with connected clients

---

## Future Improvements

* Horizontal scaling with message queues
* Redis caching layer
* Metrics and monitoring (Prometheus/Grafana)
* Persistent event replay and backfill

---
