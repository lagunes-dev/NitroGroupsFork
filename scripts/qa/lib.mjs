// Andamiaje de las críticas y de la verificación visual del orquestador.
// Vive en el repo a propósito: /tmp se vacía en cada reinicio y con él se perdieron lib.mjs, las
// sesiones y los scripts de medición (dos veces). Requiere playwright-core instalado; se resuelve del
// caché de npx si no está en el proyecto.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/adminr/.npm/_npx/705bc6b22212b352/node_modules/playwright-core');

export const BASE = 'http://localhost:3001';
export const API = 'http://localhost:5144';
export const WORK = process.env.NG_WORK ?? '/tmp/ng-agents';
export const PERSONAS = {
  cliente: 'cliente.demo@example.com',
  musico: 'musico.demo@example.com',
  manager: 'manager.demo@example.com',
  miembro: 'miembro.demo@example.com',
};
// Cuentas de demostración, creadas por scripts/db/demo-accounts.sql en el tenant de Auth0 de QA.
const PASSWORD = 'Nitro-Demo-2026';
const dir = (p) => `${WORK}/${p}`;
const statePath = (p) => `${dir(p)}/state.json`;

export async function open(persona, { width = 1440, height = 900 } = {}) {
  fs.mkdirSync(`${dir(persona)}/shots`, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width, height },
    ...(fs.existsSync(statePath(persona)) ? { storageState: statePath(persona) } : {}),
  });
  // SOLO LECTURA POR CONSTRUCCIÓN: dos críticas escribieron pese a la regla escrita en el prompt. El
  // navegador aborta todo lo que no sea lectura contra el API y deja constancia. Los endpoints de
  // sesión de Next pasan. Para sembrar datos a propósito: ALLOW_WRITES=1.
  if (!process.env.ALLOW_WRITES) {
    await ctx.route(
      (url) => /^(localhost|127\.0\.0\.1)$/.test(url.hostname) && (url.port === '5144' || (url.port === '3001' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/auth/'))),
      async (route) => {
        const m = route.request().method();
        if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
        fs.appendFileSync(`${WORK}/blocked-writes.log`, `${new Date().toISOString()} ${persona} ${m} ${route.request().url()}\n`);
        return route.abort('blockedbyclient');
      }
    );
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  // EVIDENCIA AUTOMÁTICA: cada respuesta 4xx/5xx del API y cada error de consola o de página quedan
  // registrados por persona. Una crítica que dice "no funcionó" sin esto solo tiene su impresión; con esto
  // tiene el endpoint, el estado y la hora. Los 401 de la sonda de sesión también caen aquí: se leen, no
  // se reportan a ciegas.
  const logFile = `${WORK}/http-errors.log`;
  const note = (kind, detail) => fs.appendFileSync(logFile, `${new Date().toISOString()} ${persona} ${kind} ${detail}\n`);
  page.on('response', (res) => {
    const url = res.url();
    const isApi = url.includes(':5144/') || /localhost:3001\/api\//.test(url);
    if (isApi && res.status() >= 400) note('HTTP', `${res.status()} ${res.request().method()} ${url}`);
  });
  page.on('console', (msg) => { if (msg.type() === 'error') note('CONSOLE', msg.text().slice(0, 300)); });
  page.on('pageerror', (err) => note('PAGEERROR', String(err.message).slice(0, 300)));
  return { browser, ctx, page, close: () => browser.close() };
}

export async function login(persona) {
  const { browser, ctx, page } = await open(persona);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.getByRole('textbox', { name: /Correo/ }).fill(PERSONAS[persona]);
  await page.getByRole('textbox', { name: /Contraseña/ }).fill(PASSWORD);
  await page.getByRole('button', { name: /Iniciar sesión/ }).first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const ok = !page.url().includes('/login');
  if (ok) await ctx.storageState({ path: statePath(persona) });
  await browser.close();
  return { ok, url: page.url().replace(BASE, '') };
}
