#!/usr/bin/env node
/**
 * Ejecutar manualmente o via crontab:
 *   0 *\/6 * * * cd /root/PoC_Smartlex_DocAI && node dist/jobs/cron-notion.js >> logs/notion-sync.log 2>&1
 */
import { sincronizarNotion } from './sincronizarNotion';

sincronizarNotion()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[cron-notion] Error fatal:', err);
    process.exit(1);
  });
