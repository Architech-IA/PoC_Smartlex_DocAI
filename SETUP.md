# SETUP — Smartlex DocAI

Guía completa para operar Smartlex DocAI sin asistencia. Léela de principio a fin antes del primer deploy.

---

## Índice

1. [Requisitos del sistema](#1-requisitos-del-sistema)
2. [Primera instalación en VPS](#2-primera-instalación-en-vps)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Claude Code — cuenta de servicio](#4-claude-code--cuenta-de-servicio)
5. [rclone — Drive compartido](#5-rclone--drive-compartido)
6. [Tactiq — exportación automática](#6-tactiq--exportación-automática)
7. [Nginx — reverse proxy](#7-nginx--reverse-proxy)
8. [Backup de base de datos](#8-backup-de-base-de-datos)
9. [Crontab completo](#9-crontab-completo)
10. [Actualizar la plataforma](#10-actualizar-la-plataforma)
11. [Activar sincronización de Notion](#11-activar-sincronización-de-notion)
12. [Segundo Cerebro — vault de Obsidian](#12-segundo-cerebro--vault-de-obsidian)
13. [Operación diaria y monitoreo](#13-operación-diaria-y-monitoreo)

---

## 1. Requisitos del sistema

| Componente | Versión mínima | Notas |
|---|---|---|
| Docker | 24+ | Con Docker Compose v2 |
| Nginx | 1.18+ | En el host, no en contenedor |
| Ollama | 0.3+ | En el host, modelo `qwen3-embedding:0.6b` cargado |
| Python 3 + psutil | 3.10+ | Para el agente de métricas |
| rclone | 1.65+ | Para montar Google Drive |
| Certbot | Cualquiera | Para TLS con Let's Encrypt |

El stack de la app corre completamente en Docker:
- `smartlex-docai` — Next.js en puerto 3002
- `smartlex-db` — Postgres 16 + pgvector

```bash
# Verificar Ollama y modelo
ollama list | grep qwen3-embedding
# Debe mostrar: qwen3-embedding:0.6b
# Si no está: ollama pull qwen3-embedding:0.6b
```

---

## 2. Primera instalación en VPS

```bash
# 1. Clonar el repositorio
git clone https://github.com/Architech-IA/PoC_Smartlex_DocAI.git /root/PoC_Smartlex_DocAI
cd /root/PoC_Smartlex_DocAI

# 2. Crear carpetas de datos en el host
mkdir -p /root/smartlex-ingesta /root/smartlex-vault /root/smartlex-backups
chmod 777 /root/smartlex-ingesta /root/smartlex-vault

# 3. Crear .env con las variables (ver sección 3)
cp .env.example .env
nano .env   # completar las variables necesarias

# 4. Levantar los servicios
docker compose up -d

# 5. Esperar que db esté lista (~10s) y correr migraciones
sleep 10
docker exec smartlex-docai npx prisma migrate deploy

# 6. Verificar que todo está Up
docker compose ps
```

---

## 3. Variables de entorno

El archivo `.env` debe estar en `/root/PoC_Smartlex_DocAI/.env` en la VPS.

```env
# Base de datos (no cambiar si usás docker-compose tal cual)
DATABASE_URL=postgresql://postgres:postgres@db:5432/smartlex_docai
DIRECT_URL=postgresql://postgres:postgres@db:5432/smartlex_docai

# Ollama (embeddings — corre en el host, accesible desde el contenedor por host-gateway)
OLLAMA_URL=http://host-gateway:11434
OLLAMA_MODEL=qwen3-embedding:0.6b
OLLAMA_EMBEDDING_DIM=1024

# Carpetas montadas (volúmenes Docker)
INGESTA_BASE_PATH=/app/ingesta
OBSIDIAN_VAULT_PATH=/app/vault

# Límites y retención
MAX_DOCUMENTO_MB=15
RETENCION_ANIOS=10

# Notion (dejar vacío hasta tener el token — no rompe nada si está vacío)
NOTION_TOKEN=
NOTION_SYNC_INTERVAL_HOURS=6

# Runtime
NODE_ENV=production
HOME=/home/nextjs
```

> **Importante**: el `.env` **no** se sube al repo (está en `.gitignore`). Si perdés el archivo, recrealo con los valores de arriba más el `NOTION_TOKEN` cuando lo tengás.

---

## 4. Claude Code — cuenta de servicio

La app invoca Claude Code CLI desde adentro del contenedor para clasificar documentos y generar actas. El CLI necesita estar autenticado con la cuenta de servicio de ArchiTechIA.

Las credenciales se montan como volumen read-only desde el host:
```yaml
volumes:
  - /root/.claude:/home/nextjs/.claude:ro
  - /root/.claude.json:/home/nextjs/.claude.json:ro
```

**Si las credenciales expiran o hay que renovarlas:**

```bash
# 1. En el HOST de la VPS (no dentro del contenedor), loguear Claude Code
claude auth login

# 2. Verificar permisos de los archivos de credenciales
chmod 644 /root/.claude.json
chmod 644 /root/.claude/.credentials.json

# 3. Reiniciar el contenedor para que tome las nuevas credenciales
cd /root/PoC_Smartlex_DocAI && docker compose restart app
```

**Para verificar que el CLI funciona dentro del contenedor:**

```bash
docker exec smartlex-docai claude --version
# Debe mostrar la versión sin error de autenticación
```

---

## 5. rclone — Drive compartido

rclone sincroniza dos carpetas de Google Drive con el host:

| Carpeta Drive | Mount en VPS | Uso |
|---|---|---|
| `SmartlexIngesta` | `/root/smartlex-ingesta` | Bandeja de entrada de documentos y transcripts Tactiq |
| `SmartlexVault` | `/root/smartlex-vault` | Vault de Obsidian — notas generadas por la app |

### Instalación

```bash
curl https://rclone.org/install.sh | sudo bash
```

### Configurar remote de Google Drive

```bash
rclone config
# Seguir el asistente:
# → n (new remote)
# → nombre: gdrive
# → tipo: drive (Google Drive)
# → client_id y client_secret: dejar vacío (usa los defaults de rclone)
# → scope: 1 (full access)
# → root_folder_id: dejar vacío
# → service_account_file: dejar vacío
# → Edit advanced config: No
# → Use web browser to authenticate: Yes (necesitás un browser en tu máquina local)
#   rclone te da un link → abrilo en tu browser → autorizá con la cuenta de Google del workspace
# → Configure as team drive: No (a menos que sea un Drive compartido de Google Workspace)
```

### Montar las carpetas

```bash
# Crear puntos de montaje (si no existen)
mkdir -p /root/smartlex-ingesta /root/smartlex-vault

# Montar ingesta
rclone mount gdrive:SmartlexIngesta /root/smartlex-ingesta \
  --vfs-cache-mode writes \
  --daemon \
  --log-file /var/log/rclone-ingesta.log

# Montar vault
rclone mount gdrive:SmartlexVault /root/smartlex-vault \
  --vfs-cache-mode writes \
  --daemon \
  --log-file /var/log/rclone-vault.log

# Verificar que están montadas
ls /root/smartlex-ingesta
ls /root/smartlex-vault
```

### Persistir los mounts al reiniciar (crontab)

Agregar al crontab (`crontab -e`):

```cron
@reboot sleep 10 && rclone mount gdrive:SmartlexIngesta /root/smartlex-ingesta --vfs-cache-mode writes --daemon --log-file /var/log/rclone-ingesta.log
@reboot sleep 10 && rclone mount gdrive:SmartlexVault /root/smartlex-vault --vfs-cache-mode writes --daemon --log-file /var/log/rclone-vault.log
```

> **Nota**: el `sleep 10` da tiempo a que la red esté lista antes de intentar montar.

---

## 6. Tactiq — exportación automática

Tactiq puede exportar automáticamente las transcripciones de reuniones de Google Meet a Google Drive.

**Configuración en Tactiq:**
1. Ir a [Tactiq Settings → Integrations → Google Drive](https://app.tactiq.io/settings)
2. Activar **"Auto-save to Google Drive"**
3. Seleccionar la carpeta: `SmartlexIngesta/Tactiq/` (dentro del Drive compartido)
4. Formato de exportación: **Plain Text (.txt)**

Una vez configurado, cada reunión grabada con Tactiq guardará el transcript automáticamente en `SmartlexIngesta/Tactiq/`, rclone lo sincronizará a `/root/smartlex-ingesta/Tactiq/` en la VPS, y el watcher de la app lo detectará, generará el acta con Claude Code y la guardará en la base de datos.

---

## 7. Nginx — reverse proxy

Smartlex DocAI corre en el puerto 3002 del host. Para exponerlo con un dominio y HTTPS:

### Crear config de nginx

```bash
nano /etc/nginx/sites-available/smartlex
```

Pegar:

```nginx
server {
    server_name smartlex.architechia.co;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/javascript application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Subida de archivos hasta 20MB (MAX_DOCUMENTO_MB=15 + margen)
    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Headers de seguridad
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    }

    listen 80;
}
```

```bash
# Activar
ln -s /etc/nginx/sites-available/smartlex /etc/nginx/sites-enabled/smartlex
nginx -t && nginx -s reload

# Activar HTTPS con certbot (requiere que el DNS de smartlex.architechia.co apunte a esta VPS)
certbot --nginx -d smartlex.architechia.co
```

> **DNS**: agregar un registro A `smartlex` → `177.7.46.87` en el panel de Hostinger antes de correr certbot.

---

## 8. Backup de base de datos

### Script de backup

Crear `/root/backup-smartlex-db.sh`:

```bash
#!/bin/bash
# Backup diario de la base de datos Smartlex DocAI
# Retención: 7 días

BACKUP_DIR="/root/smartlex-backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/smartlex_$TIMESTAMP.dump"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# pg_dump en formato comprimido custom (-Fc)
docker exec smartlex-db pg_dump \
  -U postgres \
  -d smartlex_docai \
  -Fc \
  -f /tmp/smartlex_backup.dump

# Copiar del contenedor al host
docker cp smartlex-db:/tmp/smartlex_backup.dump "$BACKUP_FILE"

# Limpiar copia temporal del contenedor
docker exec smartlex-db rm /tmp/smartlex_backup.dump

# Eliminar backups más viejos que RETENTION_DAYS días
find "$BACKUP_DIR" -name "smartlex_*.dump" -mtime +$RETENTION_DAYS -delete

echo "$(date '+%Y-%m-%d %H:%M:%S') Backup completado: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"
```

```bash
chmod +x /root/backup-smartlex-db.sh

# Probar manualmente
/root/backup-smartlex-db.sh
ls -lh /root/smartlex-backups/
```

### Restaurar un backup

```bash
# Ver backups disponibles
ls -lht /root/smartlex-backups/

# Restaurar (reemplaza la base actual)
docker cp /root/smartlex-backups/smartlex_YYYYMMDD_HHMMSS.dump smartlex-db:/tmp/restore.dump
docker exec smartlex-db pg_restore \
  -U postgres \
  -d smartlex_docai \
  --clean --if-exists \
  /tmp/restore.dump
docker exec smartlex-db rm /tmp/restore.dump
```

---

## 9. Crontab completo

Correr `crontab -e` en la VPS y pegar **todo** lo siguiente:

```cron
# ─── Smartlex DocAI — Crontab del host ──────────────────────────────────────

# Backup diario de la base de datos — 3:00 AM (hora Colombia, UTC-5 = 8:00 AM UTC)
0 8 * * * /root/backup-smartlex-db.sh >> /var/log/smartlex-backup.log 2>&1

# Reporte de huérfanos — todos los lunes a las 7:00 AM Colombia (12:00 UTC)
0 12 * * 1 docker exec smartlex-docai node -e "require('/app/.next/server/jobs/reporteHuerfanos.js')" >> /var/log/smartlex/huerfanos.log 2>&1

# Sincronización Notion → Obsidian — cada 6 horas (activar cuando haya NOTION_TOKEN)
# 0 */6 * * * docker exec smartlex-docai node -e "require('/app/.next/server/jobs/cron-notion.js')" >> /var/log/smartlex/notion-sync.log 2>&1

# Mounts de rclone al reiniciar
@reboot sleep 10 && rclone mount gdrive:SmartlexIngesta /root/smartlex-ingesta --vfs-cache-mode writes --daemon --log-file /var/log/rclone-ingesta.log
@reboot sleep 10 && rclone mount gdrive:SmartlexVault /root/smartlex-vault --vfs-cache-mode writes --daemon --log-file /var/log/rclone-vault.log
```

> La línea de Notion está comentada (`#`). Descomentarla una vez que `NOTION_TOKEN` esté en el `.env` y el cron probado manualmente.

```bash
# Crear directorio de logs de Smartlex
mkdir -p /var/log/smartlex
```

---

## 10. Actualizar la plataforma

Cada vez que haya un nuevo commit en `main`:

```bash
cd /root/PoC_Smartlex_DocAI

# 1. Bajar cambios
git pull origin main

# 2. Rebuild de la imagen
docker compose build app

# 3. Reiniciar con la nueva imagen
docker compose up -d

# 4. Si hay nuevas migraciones de Prisma
docker exec smartlex-docai npx prisma migrate deploy

# 5. Verificar que todo está Up
docker compose ps
docker logs smartlex-docai --tail 20
```

---

## 11. Activar sincronización de Notion

### Crear el token de integración

1. Ir a [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Nombre: `Smartlex DocAI`
4. Workspace: el de Smartlex
5. Capacidades: solo **"Read content"** (no necesita escribir ni usuarios)
6. Guardar → copiar el **"Internal Integration Token"** (empieza con `secret_`)

### Compartir páginas con la integración

En cada página o base de datos de Notion que quieras sincronizar:
1. Click en `...` (menú de la página) → **"Add connections"**
2. Buscar y seleccionar `Smartlex DocAI`

### Activar en la VPS

```bash
# 1. Agregar el token al .env
nano /root/PoC_Smartlex_DocAI/.env
# → NOTION_TOKEN=secret_xxxxxxxxxxxx

# 2. Reiniciar el contenedor para que tome el nuevo env
docker compose restart app

# 3. Probar la sync manualmente
docker exec smartlex-docai node -e "require('/app/.next/server/jobs/cron-notion.js')"
# → Verificar que aparecen archivos en /root/smartlex-vault/Expedientes-Notion/

# 4. Descomentar la línea del cron (ver sección 9)
crontab -e
# → Quitar el # del inicio de la línea de sincronización Notion
```

---

## 12. Segundo Cerebro — vault de Obsidian

El vault se genera automáticamente en `/root/smartlex-vault/` (que con rclone apunta a `SmartlexVault` en Drive).

### Estructura generada

```
SmartlexVault/
  Documentos/
    ACTA/          ← actas generadas desde transcripciones
    CONTRATO/      ← contratos clasificados
    FORMATO/
    DOCUMENTACION_LEGAL/
    OTRO/
  Expedientes-Notion/
    YYYY-MM-DD-nombre-expediente.md   ← páginas de Notion sintetizadas
```

### Abrir en Obsidian (en tu máquina local)

1. Instalar [Obsidian](https://obsidian.md)
2. **Open folder as vault** → seleccionar la carpeta de Google Drive sincronizada localmente con Google Drive for Desktop
3. Los documentos aparecen enlazados por `[[Proyecto - Nombre]]` — el grafo se arma solo

---

## 13. Operación diaria y monitoreo

### Comandos útiles

```bash
# Ver estado de los contenedores
docker compose -f /root/PoC_Smartlex_DocAI/docker-compose.yml ps

# Ver logs en vivo de la app
docker logs -f smartlex-docai

# Ver logs del watcher específicamente
docker logs smartlex-docai 2>&1 | grep '\[watcher\]'

# Ver último backup
ls -lht /root/smartlex-backups/ | head -3

# Ver log de backups
tail -20 /var/log/smartlex-backup.log

# Ver log de la sync de Notion
tail -20 /var/log/smartlex/notion-sync.log

# Reiniciar solo la app (sin tocar la DB)
docker compose -f /root/PoC_Smartlex_DocAI/docker-compose.yml restart app
```

### Si la app no responde

```bash
# 1. Ver qué pasó
docker logs smartlex-docai --tail 50

# 2. Reiniciar
docker compose -f /root/PoC_Smartlex_DocAI/docker-compose.yml restart app

# 3. Si sigue sin responder, rebuild completo
cd /root/PoC_Smartlex_DocAI
docker compose down && docker compose up -d
sleep 10
docker exec smartlex-docai npx prisma migrate deploy
```

### Alertas de capacidad

| Métrica | Umbral de atención |
|---|---|
| Disco `/root/smartlex-backups` | >10GB — revisar retención o mover a Drive |
| Disco total VPS | >60% — planificar migración de `archivoBase64` a MinIO |
| RAM contenedores | `docker stats` — si `smartlex-docai` supera 1GB sostenido |

---

## Fuera de alcance de este PoC (próximas fases)

- Agente conversacional por Telegram/WhatsApp (reusa las mismas Skills)
- Autenticación y permisos por usuario
- UI de subida de documentos en el navegador (`/documentos/subir`)
- Migración a MinIO cuando la base supere ~20GB
- Conectar módulo CRM a datos reales (hoy usa mock interno)
- Skills `generar-desde-plantilla` y `comparar-documentos`
- Notificaciones push de alertas de vencimiento (email/WhatsApp)
