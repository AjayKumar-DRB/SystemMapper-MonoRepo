# SystemMapper

SystemMapper is an advanced, automated architectural visualization tool. It scans repositories, parses JavaScript/TypeScript code via ASTs, and leverages graph algorithms to generate beautiful, interactive architectural maps of your codebase.

Built with performance and scalability in mind, it utilizes an asynchronous worker architecture to handle massive monorepos and relies on an in-memory graph database (Memgraph) for lightning-fast topological querying.

## 🚀 Tech Stack
* **Frontend**: Next.js (App Router), React Flow, Cytoscape.js, TailwindCSS
* **Backend API**: NestJS, REST
* **Background Worker**: NestJS, BullMQ, Babel AST Parser
* **Databases**: 
  * **Memgraph**: Core graph database for mapping code architecture
  * **PostgreSQL**: Relational storage for repository metadata
  * **Redis**: Message broker for BullMQ job queues
* **Architecture**: Turborepo (Monorepo), Docker

---

## 💻 Local Development

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the databases:**
   Ensure Docker is running, then spin up Memgraph, Postgres, and Redis:
   ```bash
   docker compose up -d
   ```

3. **Start the application:**
   Launch the Next.js frontend, NestJS API, and Worker simultaneously:
   ```bash
   pnpm dev
   ```

---

## 🌍 Production Deployment Guide

You can deploy this application for **$0/month** by hosting the frontend on Netlify and the backend/databases on a free Oracle Cloud VPS.

### Part 1: Backend & Databases (Oracle Cloud)

Oracle Cloud offers a generous "Always Free" tier providing an ARM VM with 4 Cores and 24GB RAM. This is perfect for running our backend APIs and databases.

1. **Provision the Server**: Sign up for Oracle Cloud and create an "Ampere A1 Compute" instance with up to 4 OCPUs and 24GB RAM.
2. **Open Ports**: In your Oracle VCN (Virtual Cloud Network) security list, open TCP port `3001` (for the API).
3. **SSH into the Server & Install Docker**:
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   ```
4. **Clone the Repository**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/SystemMapper.git
   cd SystemMapper
   ```
5. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env to add your GITHUB_TOKEN
   ```
6. **Deploy the Backend Stack**:
   Since the frontend will live on Netlify, we only spin up the backend, worker, and databases:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build api worker memgraph postgres redis
   ```
   *Your API is now running at `http://<YOUR_ORACLE_PUBLIC_IP>:3001`*

### Part 2: Frontend (Netlify)

Netlify provides highly optimized, free hosting for Next.js applications.

1. **Log in to Netlify** and click **Add new site** -> **Import an existing project**.
2. **Connect to GitHub** and select your `SystemMapper` repository.
3. **Configure Build Settings**:
   Because this is a Turborepo monorepo, configure the exact settings below:
   * **Base directory**: `apps/web`
   * **Build command**: `pnpm run build`
   * **Publish directory**: `.next`
4. **Add Environment Variables**:
   Click "Add environment variables" and add the following so your frontend knows how to talk to your Oracle backend:
   * **Key**: `NEXT_PUBLIC_API_URL`
   * **Value**: `http://<YOUR_ORACLE_PUBLIC_IP>:3001`
5. **Deploy**: Click **Deploy Site**.

Netlify will automatically build the Next.js app and assign you a live URL. Your fully deployed, distributed architecture is now live for free!
