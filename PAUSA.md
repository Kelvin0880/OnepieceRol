# Pausar y reanudar el juego

Un interruptor para dejar todo quieto sin apagar la página (AdSense, la portada, noticias y códice siguen visibles).

## Comandos

```bash
node scripts/game-pause.mjs status   # ¿está en pausa?
node scripts/game-pause.mjs on       # PAUSAR todo
node scripts/game-pause.mjs off      # REANUDAR todo
```

Sin `--dev` el script habla con **producción**. Te pide la conexión de Neon (la escribes y **no se guarda en ningún sitio**),
o la pones antes en una variable de la terminal y no pregunta:

```powershell
$env:GAME_DATABASE_URL = "postgresql://..."   # solo vale para esa terminal
node scripts/game-pause.mjs on
```

Tarda ~20 s (genera un cliente temporal de Postgres y lo borra al terminar). El cambio se nota en la web en unos 5 segundos.
Para probar en tu base local: añade `--dev`.

**Orden recomendado la primera vez:** sube este cambio a GitHub (Render lo despliega) y *después* ejecuta `on`. El script
también funciona antes del despliegue, pero hasta que se despliegue la web nueva no hace efecto.

## Qué hace la pausa

- **IA:** ninguna llamada a OpenRouter (narrador, árbitro, jueces, noticias, eventos). Es un único punto de corte: `callOpenRouter`.
- **Mundo quieto:** no corre el reloj del mundo ni sus eventos: noticias, eventos mundiales, Coliseo, guerras, despachos de
  almirantes, sucesores de residentes, sucesos del mundo, eventos para novatos, puestos de mando.
- **Nadie puede actuar:** toda escritura devuelve «El juego está en pausa» (503): registrarse, crear personaje, acciones,
  tienda, tripulación, duelos, Den Den Mushi, voz del narrador, panel de administración. Tampoco se puede abrir la ficha de un
  personaje (leerla ejecuta lógica del mundo). Se puede **iniciar y cerrar sesión**.
- **Se puede mirar:** portada, noticias, eventos mundiales, códice, mapa y guía. Todas las páginas muestran una franja
  «⏸ El juego está en pausa…».
- Nada se borra ni se pierde: personajes, bitácoras, memoria del narrador y todo lo demás quedan tal cual.

## Qué hace al reanudar (`off`)

Mientras estuvo en pausa pasó tiempo real, así que `off` **mueve hacia adelante, exactamente ese tiempo**, todos los relojes
vivos (en una sola transacción: si algo falla, no cambia nada y puedes repetirlo):

- cooldowns (entrenar, viajar, estudiar escritura antigua, retos), estamina, viajes en curso, tributos de Shichibukai,
- guarniciones y plazos de territorios, asaltos, Buster Calls, votaciones,
- guerras (frentes y duración), eventos mundiales (siguiente capítulo), Coliseo (inicio/rondas), despachos de almirantes,
- reloj del mundo, consecuencias pendientes, residentes heridos o en espera de sucesor, canon ocupado/capturado,
- duelos, peleas conjuntas y retos canon abiertos (para que no caduquen por el tiempo pausado), invitaciones, eventos abiertos.

Resultado: nada «se pone al día» de golpe, no caduca nada, y el mundo sigue exactamente desde donde lo dejaste. Lo único que
no se mueve son los registros históricos («cuándo murió», «desde cuándo es Yonko») y la presencia «en línea».

El script imprime cuánto estuvo en pausa y cuántas filas movió por tabla.

## Si añades columnas de fecha nuevas

`src/lib/engine/pause.test.ts` falla si una columna `DateTime` de `schema.prisma` no está decidida en
`src/lib/engine/pause.ts` (`PAUSE_SHIFT` = se mueve al reanudar, `PAUSE_IGNORE` = se deja). Es a propósito: obliga a pensar qué
hace una pausa con cada reloj nuevo.

## Detalles técnicos

- Estado: `WorldClock.pausedAt` (null = en marcha). El servidor añade la columna solo al arrancar
  (`src/instrumentation.ts`), sin push manual a Neon.
- Corte de peticiones: `src/proxy.ts` (+ `blockedWhilePaused`). Banner: `src/components/ui/PauseBanner.tsx`, estado público en `GET /api/pause`.
- Lógica: `src/lib/game/pause.ts` (`pauseGame`, `resumeGame`). Comprobación completa contra la base local: `npx tsx scripts/pause-check.ts`.
- Aviso: si la web duerme en Render y alguien entra, el primer acceso la despierta como siempre; con la pausa puesta no gasta IA ni cambia nada.
