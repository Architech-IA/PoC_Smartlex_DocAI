# SETUP — Smartlex DocAI

## Requisitos

- Node.js >= 20 (via nvm)
- PostgreSQL + pgvector
- Ollama con modelo `qwen3-embedding:0.6b`
- Variables de entorno en `.env` (ver `.env.example`)

## Instalación

```bash
npm install
npx prisma generate
npx prisma db push
npm run build
pm2 start ecosystem.config.js
```

## Cron: Reporte de Huérfanos

El job `src/jobs/reporteHuerfanos.ts` detecta documentos sin proyecto asociado y documentos atascados (PROCESANDO >1h o en estado ERROR).

Agregar al crontab del VPS (`crontab -e`):

```cron
# Reporte de huérfanos — todos los lunes a las 7:00 AM (hora Colombia, UTC-5)
0 12 * * 1 cd /var/www/smartlex && npx tsx src/jobs/reporteHuerfanos.ts >> /var/log/smartlex/huerfanos.log 2>&1
```

Crear el directorio de logs si no existe:

```bash
mkdir -p /var/log/smartlex
```

## Despliegue en VPS (Hostinger KVM2)

```bash
# Clonar / actualizar
git pull origin main

# Reinstalar dependencias si cambiaron
npm ci

# Regenerar cliente Prisma
npx prisma generate

# Rebuild
npm run build

# Reiniciar con pm2
pm2 restart smartlex-docai
```

## Puertos

| Servicio | Puerto |
|----------|--------|
| Next.js  | 3002   |
| Ollama   | 11434  |
