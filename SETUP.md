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

## Segundo Cerebro — Obsidian + Notion

### Variables de entorno requeridas

```env
OBSIDIAN_VAULT_PATH=/mnt/gdrive/SmartlexVault   # Carpeta del vault montada con rclone
NOTION_TOKEN=secret_xxxx                          # Token de integración Notion (solo lectura)
```

### Montar vault con rclone

```bash
# Instalar rclone y configurar Google Drive
rclone config  # seguir asistente para crear remote "gdrive"

# Montar el vault (persistente)
rclone mount gdrive:SmartlexVault /mnt/gdrive/SmartlexVault \
  --vfs-cache-mode writes --daemon

# Agregar al crontab para que monte al reiniciar
@reboot rclone mount gdrive:SmartlexVault /mnt/gdrive/SmartlexVault --vfs-cache-mode writes --daemon
```

### Cron: Sincronización de Notion

El job `src/jobs/cron-notion.ts` consulta páginas modificadas en Notion desde la última ejecución, las sintetiza con Claude Code y las escribe como notas `.md` en `OBSIDIAN_VAULT_PATH/Expedientes-Notion/`.

Agregar al crontab del VPS (`crontab -e`):

```cron
# Sincronización Notion → Obsidian — cada 6 horas
0 */6 * * * cd /root/PoC_Smartlex_DocAI && node .next/server/jobs/cron-notion.js >> logs/notion-sync.log 2>&1
```

El timestamp de la última sincronización se guarda en `data/notion-sync-ts.txt`.

### Estructura del vault generada

```
SmartlexVault/
  Documentos/
    ACTA/          ← actas generadas desde transcripciones
    CONTRATO/      ← contratos clasificados
    OTRO/          ← resto de tipos
  Expedientes-Notion/
    2026-07-08-Nombre-Expediente.md   ← páginas de Notion sintetizadas
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
