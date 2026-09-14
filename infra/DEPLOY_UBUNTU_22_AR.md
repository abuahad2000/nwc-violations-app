# النشر على Ubuntu 22.04

1. ثبّت Docker Engine وCompose Plugin، ثم أضف المستخدم إلى مجموعة Docker:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git nginx certbot
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
```

سجّل الخروج والدخول مرة أخرى بعد إضافة المجموعة.

2. اجلب المشروع:

```bash
sudo mkdir -p /opt/nitaq
sudo chown "$USER":"$USER" /opt/nitaq
git clone https://github.com/abuahad2000/nwc-violations-app.git /opt/nitaq
cd /opt/nitaq
```

3. أنشئ ملف الأسرار:

```bash
cp infra/.env.production.example .env.production
nano .env.production
```

غيّر النطاق وكلمات مرور PostgreSQL وRedis و`JWT_SECRET`. لا ترفع الملف إلى GitHub.

4. أنشئ مجلد تحدي الشهادة وأصدر الشهادة قبل تشغيل HTTPS:

```bash
mkdir -p infra/nginx/certbot/www infra/nginx/letsencrypt
sudo certbot certonly --webroot -w infra/nginx/certbot/www -d nitaq.example.com
sudo cp -a /etc/letsencrypt/. infra/nginx/letsencrypt/
```

استبدل `nitaq.example.com` بنطاقك الحقيقي، ووجّه DNS إلى عنوان الخادم وافتح المنفذين 80 و443.

5. امنح السكريبت صلاحية التشغيل ونفّذ النشر:

```bash
chmod +x infra/deploy.sh
./infra/deploy.sh
```

6. التحقق والسجلات:

```bash
curl -f https://nitaq.example.com/health
curl -f https://nitaq.example.com/api/test/health
docker compose --env-file .env.production -f docker-compose.production.yml ps
docker compose --env-file .env.production -f docker-compose.production.yml logs -f backend nginx
```

لتفعيل pg_tileserv عند الحاجة:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml --profile tiles up -d pg_tileserv
```

## التجديد والمراقبة

جدولة التجديد:

```bash
sudo certbot renew --quiet
sudo cp -a /etc/letsencrypt/. /opt/nitaq/infra/nginx/letsencrypt/
cd /opt/nitaq && docker compose -f docker-compose.production.yml restart nginx
```

فعّل Sentry بوضع `SENTRY_DSN` في ملف البيئة عند توفر الحساب. سجلات Gunicorn وNginx تُقرأ عبر Docker، و`/metrics` يعرض مؤشرات الطلبات الأساسية.
