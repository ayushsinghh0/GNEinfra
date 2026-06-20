# Deploy — GNE ERP (Vendor Registration)

Cheap single-box deployment: the Next.js app + Caddy (auto-HTTPS) run on one small
server; the database is **Neon** (free hosted Postgres); uploaded files live on the
box's local disk and auto-purge. No RDS, no S3, no load balancer.

## Cost

| Piece | Service | Cost |
| ----- | ------- | ---- |
| Database | Neon free tier | **$0 — always free** (0.5 GB) |
| App + proxy | EC2 `t3.micro` | **$0 for 12 months** (AWS free tier), then ~$6–8/mo |

> AWS has no *always-free* always-on compute, so after the 12-month free tier the
> EC2 costs a few dollars/month. If you want **$0 forever**, the app can instead run
> on **Vercel's free tier** with Neon — the only change needed is moving file uploads
> to S3 (`STORAGE_DRIVER=s3`), since Vercel's filesystem is ephemeral.

## First-time setup (fresh box)

1. Launch an Ubuntu `t3.micro`, open ports **22, 80, 443** in the Security Group.
2. Create a free DB at [neon.tech], copy its connection string.
3. SSH in, then:
   ```bash
   git clone https://github.com/ayushsinghh0/GNEinfra.git ~/GNEinfra
   cd ~/GNEinfra && git checkout vendor-only
   cp deploy/.env.server.example .env   # then edit .env with the Neon URL, admin pwd, SMTP
   DOMAIN=<public-ip>.sslip.io ./deploy/bootstrap.sh
   ```
   `sslip.io` resolves `<ip>.sslip.io` to your IP so Let's Encrypt can issue a real
   cert for a box that has no domain. Swap in your own hostname once you have one.

## Redeploy (after pushing code)

```bash
cd ~/GNEinfra && ./deploy/redeploy.sh
```

## Notes

- `bootstrap.sh` adds 1 GB swap so `next build` doesn't OOM on a 1 GB instance.
- The app **must** be served over HTTPS (Caddy handles this) — the admin login cookie
  is `Secure`, so over plain HTTP browsers silently drop it and login appears to fail.
- Migrations are applied with `prisma migrate deploy` against the Neon `DATABASE_URL`.
