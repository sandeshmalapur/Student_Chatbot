# EC2 Deployment Guide

## 1. Launch the instance
- AWS Console -> EC2 -> Launch Instance
- AMI: Ubuntu Server 24.04 LTS
- Instance type: **t3.medium** or larger (embeddings + Qdrant need >1GB RAM; t2.micro will OOM)
- Storage: 20GB gp3 minimum
- Key pair: create/download a `.pem` key for SSH

## 2. Security group (inbound rules)
| Type       | Port | Source    | Purpose                  |
|------------|------|-----------|---------------------------|
| SSH        | 22   | Your IP   | Admin access              |
| HTTP       | 80   | 0.0.0.0/0 | Frontend                  |
| Custom TCP | 8000 | 0.0.0.0/0 | Backend + Swagger docs    |

(Do NOT expose 6333/Qdrant publicly — it has no auth by default in this compose file.)

## 3. Connect and install Docker
```powershell
# From your Windows PowerShell (adjust key path/IP):
ssh -i "C:\path\to\your-key.pem" ubuntu@<EC2_PUBLIC_IP>
```
Then on the EC2 instance:
```bash
git clone <your-github-repo-url>
cd <repo-folder>
chmod +x deploy/ec2_setup.sh
./deploy/ec2_setup.sh
newgrp docker
```

## 4. Configure environment
```bash
cp backend/.env.example backend/.env
nano backend/.env   # fill in real DATABASE_URL, JWT_SECRET_KEY, SUPABASE keys, GROQ_API_KEY
```

## 5. Set the frontend's API URL to the EC2 public IP, then build and start
```bash
export VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>:8000
docker compose up -d --build
```

## 6. Verify
- Frontend: `http://<EC2_PUBLIC_IP>/`
- Backend Swagger: `http://<EC2_PUBLIC_IP>:8000/docs`
- Health check: `http://<EC2_PUBLIC_IP>:8000/health`

## 7. Useful commands
```bash
docker compose ps                 # check container status
docker compose logs -f backend    # tail backend logs
docker compose logs -f qdrant     # tail qdrant logs
docker compose down               # stop everything
docker compose up -d --build      # rebuild after a git pull
```

## Notes
- On first PDF upload, `sentence-transformers` downloads its model (~90MB) — the first index will be slower.
- Qdrant data persists in the `qdrant_data` Docker volume; it survives `docker compose down` (but not `docker compose down -v`).
- For a real domain instead of the raw IP, point a DNS A record at the EC2 IP and set `VITE_API_BASE_URL` accordingly, then rebuild the frontend.
