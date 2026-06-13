# Deploying GNE ERP to AWS for under $5/month

This app is built so the running cost at vendor-registration volume (a handful of
submissions a week, small PDF/image uploads) is tiny. The three cost levers:

1. **Files are gzip-compressed** before storage (and we skip compression when it
   wouldn't help, so we never store more than the original).
2. **Files auto-delete 7 days after they're first downloaded** (`DOC_PURGE_DAYS`),
   so you're not paying to store documents forever — once your team has saved a
   copy, the cloud copy goes away. Only the small metadata row remains.
3. **Cheap building blocks:** S3 for files, Neon free tier for Postgres, Amazon
   SES for email, and a small/serverless compute target.

---

## Recommended architecture (cheapest)

| Piece    | Service                          | Typical monthly cost |
| -------- | -------------------------------- | -------------------- |
| Database | **Neon** free tier (0.5 GB)      | **$0**               |
| Email    | **Amazon SES**                   | ~$0 (first 62k/mo are effectively free from within AWS; otherwise $0.10/1,000) |
| Files    | **Amazon S3** (Mumbai/`ap-south-1`) | **~$0.01–0.10** (a few hundred MB, shrinking constantly thanks to the 7-day purge) |
| Compute  | see two options below            | **$0–4**             |
| **Total**|                                  | **typically < $2, comfortably < $5** |

### Compute — pick one

**Option A — Serverless (cheapest, scales to zero): AWS Lambda + CloudFront**
Deploy the Next.js app with [SST](https://sst.dev) or
[OpenNext](https://opennext.js.org). You pay per request, so at low traffic this
is often **under $1/month** (and $0 when idle). Best choice for this workload.

**Option B — One small server: EC2 `t4g.nano` (simplest to reason about)**
A `t4g.nano` (ARM, 0.5 GB RAM) is **~$3/month** on-demand, less with a savings
plan. Run the app with `npm run build && npm run start` behind it (or in Docker).
A `t3.micro` is free for the first 12 months under the AWS Free Tier. Use this if
you'd rather have a normal always-on server than serverless.

> Either way the app is identical — only `.env` changes.

---

## Step-by-step

### 1. Database (Neon)

1. Create a free project at https://neon.tech.
2. Copy the **pooled** connection string into `DATABASE_URL`.
3. Apply the schema: `npm run db:deploy`.

### 2. File storage (S3)

1. Create a bucket, e.g. `gne-vendor-docs`, in your region (`ap-south-1` = Mumbai).
2. Keep **Block Public Access ON** — files are served only through the app's
   authenticated `/api/documents/<id>` route, never directly.
3. Give the app permission to the bucket:
   - **On EC2/Lambda:** attach an **IAM role** with `s3:PutObject`,
     `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::gne-vendor-docs/*`.
     Leave `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` blank — the role is used
     automatically (most secure).
   - **Elsewhere:** create an IAM user with the same permissions and set the keys.
4. Set env:
   ```
   STORAGE_DRIVER="s3"
   S3_BUCKET="gne-vendor-docs"
   AWS_REGION="ap-south-1"
   ```

### 3. Email (Amazon SES)

1. In SES, **verify your domain** (or a single from-address to start).
2. Request **production access** (moves you out of the sandbox so you can email
   any vendor, not just verified addresses).
3. Create **SMTP credentials** in the SES console and set:
   ```
   SMTP_HOST="email-smtp.ap-south-1.amazonaws.com"
   SMTP_PORT="587"
   SMTP_SECURE="false"
   SMTP_USER="<SES SMTP username>"
   SMTP_PASS="<SES SMTP password>"
   MAIL_FROM="GNE Procurement <procurement@yourdomain.com>"
   PROCUREMENT_NOTIFY_EMAIL="procurement@yourdomain.com"
   ```
4. Verify it works: log in to `/admin → Settings → Send test email`.

> **Easiest alternative:** if you have Google Workspace/Gmail, use Gmail SMTP
> (`smtp.gmail.com`, port 587, an App Password). Free, ~500 emails/day — plenty
> for vendor onboarding. No code change, just `.env`.

### 4. Schedule the 7-day purge

The app exposes `POST /api/cron/purge` (protected by `CRON_SECRET`). Call it once
a day. Cheapest options:

- **Amazon EventBridge Scheduler** → a tiny Lambda (or HTTP target) that POSTs to
  the URL with the `Authorization: Bearer <CRON_SECRET>` header. Effectively free.
- **Free external cron** (e.g. cron-job.org, or a GitHub Actions scheduled
  workflow) hitting:
  ```
  curl -X POST https://your-app/api/cron/purge -H "Authorization: Bearer <CRON_SECRET>"
  ```

Set a long random `CRON_SECRET` in `.env`. The endpoint returns how many files it
deleted and how many bytes it freed.

### 5. App env summary (production)

```
DATABASE_URL="postgresql://...neon.../gne_erp?sslmode=require"
STORAGE_DRIVER="s3"
S3_BUCKET="gne-vendor-docs"
AWS_REGION="ap-south-1"
DOC_PURGE_DAYS="7"
CRON_SECRET="<long-random-string>"
SMTP_HOST="email-smtp.ap-south-1.amazonaws.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="..."
SMTP_PASS="..."
MAIL_FROM="GNE Procurement <procurement@yourdomain.com>"
PROCUREMENT_NOTIFY_EMAIL="procurement@yourdomain.com"
APP_BASE_URL="https://vendors.yourdomain.com"
ADMIN_PASSWORD="<strong-password>"
```

Then `npm run build && npm run start` (Option B) or deploy via SST/OpenNext
(Option A).

---

## Why this stays cheap

- The DB holds only text — even thousands of vendors are well within Neon's free
  tier.
- S3 charges for what you store; with compression + the 7-day purge, stored bytes
  stay near zero. 1 GB of S3 is about **$0.023/month** — and you'll rarely hold
  that much.
- SES and the cron are effectively free at this volume.
- Serverless compute idles at $0.

If you outgrow the free tiers (lots of vendors, heavy traffic), the same app
scales up without changes — you'd just move Neon to a paid tier and/or size up
compute.
