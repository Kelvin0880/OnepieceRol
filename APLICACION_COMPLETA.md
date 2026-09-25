# Grand Line RPG — Documento completo de la aplicación

> Referencia única y total: qué es el juego, cómo está montado, todas las
> mecánicas, cada fórmula del motor, cada modelo de datos, cada ruta, cada
> sistema de IA, el despliegue y lo que falta. Actualizado el 2026-09-23.
> Complementa (no sustituye) a `CLAUDE.md` (notas técnicas para IA),
> `WORLD_LORE.md` (roster canon), `ROLEPLAY_DESIGN.md` (diseño del rol/combate),
> `GUIA_DEL_JUGADOR.txt` y `docs/` (guía y mapa públicos).

---

## 1. Qué es

Un RPG de texto **multijugador** ambientado en One Piece. Cada jugador crea un
personaje, elige facción y arquetipo y juega escribiendo **texto libre**; una
IA narra como un máster humano, pero **nunca decide un número**: los dados y las
reglas viven en un motor determinista. Muerte permanente real, un mundo que
sigue moviéndose aunque nadie esté conectado, y un endgame construido alrededor
de los 4 Poneglifos de Ruta y Laugh Tale.

**Regla de oro de toda la arquitectura: _la IA narra, el código decide_.** La IA
solo (a) propone cómo clasificar lo que escribiste (quién es el objetivo, qué tan
duro, qué técnica, qué tan ingeniosa es tu táctica) y (b) pone prosa a un
resultado ya calculado. Cada golpe, fallo, daño, recompensa, muerte y captura
sale de `src/lib/engine/*`.

## 2. Stack y despliegue

| Pieza | Detalle |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Base de datos | Prisma **6** (fijado; v8 rompe todo). SQLite en local (`prisma/dev.db`), **Neon Postgres** en producción |
| Auth | Propia: `iron-session` v9 + `bcryptjs`. Sin NextAuth |
| Validación | `zod` en todas las rutas |
| IA | OpenRouter (HTTP `fetch` simple, sin SDK) |
| Tests | Vitest (motor + prompts + clasificador) y Playwright (verificación en navegador real) |
| Producción | Render (web service gratuito `grand-line-rpg`) + Neon (gratis, permanente). Auto-deploy al hacer `git push` a `main` |
| Guía/mapa públicos | GitHub Pages desde `/docs` (`kelvin0880.github.io/OnepieceRol/`) |

Esquema: `prisma/schema.prisma` es sqlite; `scripts/gen-prod-schema.mjs` deriva
`schema.production.prisma` (postgresql) en el build de Render. **Todo cambio de
esquema es aditivo** (regla del usuario: nunca borrar progreso).

Actualizar producción a mano: `gen-prod-schema` → `prisma generate --schema=…production` →
`DATABASE_URL=<neon> prisma db push --schema=… --skip-generate` →
`DATABASE_URL=<neon> tsx prisma/seed.ts` (idempotente, no toca User/Character) →
`prisma generate` (volver a sqlite) → `git push`. Las credenciales **nunca** se guardan en archivos.

## 3. Estructura del código

```
prisma/schema.prisma, seed.ts        Datos y contenido del mundo (fuente única)
src/lib/engine/*                     MOTOR: puro, sin Prisma ni Next, RNG con semilla; cada archivo con su .test.ts
src/lib/game/*                       Orquestación: lee/escribe BD y llama al motor
src/lib/ai/*                         IA: prompts puros, cliente OpenRouter, clasificador, narradores
src/app/api/**/route.ts              Rutas finas: zod → lib/game → errores tipados → ErrorLog
src/app/{page,create,play/[id],news} Cliente (fetch directo, sin server actions)
scripts/*                            Verificación (tsx y Playwright) y ayudantes de prueba
docs/                                Guía + mapa para GitHub Pages
```

### 3.1 Motor (`src/lib/engine`)
`rng` (mulberry32, `liveRng`, d100, tirada ponderada) · `checks` (tirada de habilidad) ·
`combat` (intercambios) · `group-battle` (N vs N) · `duel` (1 vs 1) · `death` ·
`encounter` (amenaza/huida/poder) · `events` (eventos narrativos) · `economy` ·
`character-stats` (hoja → combatiente) · `fruits`, `fruit-mastery` · `haki` ·
`techniques` · `stamina` · `scene-enemy` · `progression` (títulos por facción) ·
`condition` · `pursuit` (calor de Poneglifos) · `grudge` (rencor de NPC) ·
`rescue` · `impel-down` · `hostility` (cacerías) · `travel` · `party-turns` ·
`crew-noun` · `world` (simulación del mundo).

### 3.2 Orquestación (`src/lib/game`)
`perform-action` (explorar, entrenar, viajar, descansar, atacar, combatir, huir,
misericordia, texto libre) · `combat-prep` (estamina + técnica + fatiga → combatiente) ·
`duel` · `group-battle` · `prison` · `crew` · `party` · `grudges` · `world-tick` ·
`scene-compaction` · `death-resolution` (`handleDeathCheck`, `postNews`) ·
`reputation` (`applyBountyOrNotoriety`) · `derive` · `create-character` ·
`delete-character` · `common-gear` · `devil-fruit-catalog`.

### 3.3 IA (`src/lib/ai`)
`models` · `openrouter-client` · `classify-action` · `narrate-prompt` (constructores puros) ·
`narrate` (llamadores que nunca lanzan, con texto estático de respaldo).

## 4. Mecánicas de juego

### 4.1 Personaje
- **Facciones jugables (5):** Pirata (progreso = recompensa), Marine (rango), Revolucionario, Cazarrecompensas y **CP-0 / Gobierno Mundial** (los tres últimos = notoriedad/mérito).
- **Arquetipos (4):** Espadachín (FUE 8 AGI 9 RES 6 VOL 5 INT 4, espada de acero), Luchador (9/6/9/5/3, nudillos), Tirador (5/8/5/5/9, pistola de chispa), Fuerza Bruta (10/4/10/4/4, hacha).
- **Estadísticas:** fuerza, agilidad, resistencia, voluntad (alimenta el Haki), intelecto (alimenta la fruta). Nivel/XP (con **barra de experiencia** y **barra de rango** —título actual, siguiente y lo que falta— en la ficha y en la lista de personajes), **vida base 100**, berries (3000 al inicio), recompensa/notoriedad.
- **Islas de inicio:** Pirata → Pueblo Foosha; Marine → Cuartel Marine G-5; Revolucionario → Isla Baltigo; Cazarrecompensas → Isla Gecko; CP-0 → Loguetown.
- **Estados:** `ALIVE`, `DEAD`, `RETIRED`, `IMPRISONED`. Borrado voluntario de personaje con limpieza en cascada (`delete-character`).
- **Condición física** (`condition`): Ileso ≥90% · Rasguñado ≥60% · Herido ≥35% · Malherido ≥15% · Al borde de la muerte.

### 4.2 El bucle de juego (texto libre)
Todo se escribe en un cuadro: **Enter = salto de línea** (no envía; en móvil permite separar lo dicho de lo hecho), envío con el botón o Ctrl/Cmd+Enter, hasta **6000 caracteres**. Lo entre comillas es lo que *dice* el personaje; el resto, acción o intención.

El texto pasa por el **clasificador** (una llamada a IA) que elige UNA acción de las válidas *ahora mismo*:

| Acción | Cuándo | Efecto |
|---|---|---|
| `narrate` | Por defecto: conversar, mirar, beber, pensar… | Solo rol; sin dados ni cambios de estado |
| `explore` | Salir a buscar peligro/oportunidad **sin objetivo concreto** | Evento aleatorio del motor |
| `attack` | Violencia física directa contra alguien concreto de la escena | Pelea real contra *esa* persona |
| `train`, `rest` | Entrenar / descansar | Ver 4.7, 4.5 |
| `engage`, `flee` | Durante un combate | Una ronda / intento de huida |
| `mercy_spare`, `mercy_finish` | Tras vencer | Perdonar / rematar |
| `leave_party` | En escena compartida | Confirmación de separación |

Botones que siguen existiendo: Entrenar, Descansar, Zarpar, y los de crew/prisión/duelo/tienda.

**Seguridad del clasificador:** solo se le ofrecen acciones válidas; lo que devuelva se revalida en código; `unclear` es un no-op sin efectos (salvo en combate, donde por defecto se sigue peleando); atajo por palabras clave **solo** si la IA cae por completo; cada acción mecánica se antepone con “(interpretado como: X)”; un reintento antes de rendirse.

### 4.3 Reglas de rol: Mano Negra y Mano Blanca (`Reglasrol.txt`)
Inyectadas como `ROLE_RULES` en **todos** los prompts del narrador (también para los NPC que voz):
- **Mano Negra:** lo que escribes es tu *intención*, nunca el resultado. El narrador no da por hecho ningún golpe tuyo, no narra tus pensamientos/sensaciones/emociones ni decide por ti; los ataques de enemigos también son intentos cuyo resultado lo fija el motor.
- **Mano Blanca:** no se aprovecha lo que no especificaste; se asume sentido común (estás despierto, alerta, con ojos abiertos y tu equipo).

### 4.4 Tirada base y combate (`checks`, `combat`)
- **Tirada:** d100 + modificador vs dificultad. 1–5 = fallo crítico y 96–100 = éxito crítico **siempre**, sin importar el modificador.
- **Dificultad de encuentro:** `10 + peligro×8 − min(nivel×2, peligro×6)`, acotada 5–99.
- **Ataque:** dificultad = `40 + defensa del defensor`; tira el atacante con su `atk`. Éxito: daño `atk×0.3 + margen×0.15`; crítico: `atk×0.6 + 12`; fallo: 0.
- **Intercambio:** ambos atacan una vez (el más rápido primero; empate → el jugador). `MAX_ROUNDS = 8` (después gana el más sano; empate exacto = derrota).
- **Hoja → combatiente:** `atk = FUE + arma + mitad de la fruta×fase + Armadura×0.15 + 3 (Rey)`; `def = RES×0.8 + fruta/2 + Observación×0.08`; `vel = AGI + fruta/2`. La otra mitad de Haki/fruta se gana **usándolos activamente** (4.6).
- **Modificador táctico** (−15…+20): lo juzga la IA en la misma llamada del clasificador; se suma al `atk` (y la mitad a `def`) de esa ronda. Nunca decide quién gana.

### 4.5 Combate ronda a ronda
1. **Atacar a alguien de la escena** (`attackCharacter`): el objetivo nombrado se convierte en enemigo real. Su fuerza sale de **tus propias estadísticas** según el *tier* que propuso la IA (`scene-enemy`): débil (vida ×0.5, atk ×0.8), medio (×0.85/0.95), duro (×1.1/1.05), élite (×1.4/1.2, cuenta como jefe). Tu movimiento es la ronda 1.
2. **Amenaza por exploración:** el narrador presenta al enemigo ligándolo a lo que escribías (`narrateEncounterIntro`); la lectura de peligro (más débil/parejo/superior según `atk+def+vel`, umbrales 0.75 y 1.3) y luchar/huir.
3. **Cada mensaje = una ronda.** El narrador recibe **todas las tiradas en orden, fallos y bloqueos incluidos**, y las cuenta exactas: primero tu acción (con su resultado), luego el enemigo actuando por iniciativa propia con intención letal, y te devuelve la iniciativa.
4. **Huir:** tirada `(vel propia − vel enemiga)×2` vs 50; si falla, pierdes `atk enemigo×0.3` (×0.6 si crítico).
5. **Ayuda de compañeros:** en jefes, un compañero vivo y sano puede unirse (+15 % atk, prob. `0.25 + lealtad×0.005`).
6. **Victoria → decisión moral:** perdonar (recompensas ×0.7) o rematar. Ambas dan XP (+10), berries y recompensa/mérito; jefes dan ×3 berries y ×4.5 recompensa.
7. **Derrota → tirada de muerte** (4.9).

### 4.6 Estamina, Haki y fruta

**Estamina** (`stamina`, `combat-prep`): máx. 100; regenera **2/min** en tiempo real (perezoso, desde `staminaUpdatedAt`); descansar da +60 % del máximo. Explorar cuesta 8 (necesitas ≥8), entrenar 20, zarpar 10, cada ronda 4 (más con técnica). **Fatiga:** ≤25 % → fatigado (atk ×0.85, def ×0.9, vel ×0.85); 0 → exhausto (×0.6/0.7/0.6).

**Esfuerzo y desgaste por nivel (2026-09-24).** El clasificador mide en la misma llamada el *esfuerzo físico* de lo que describes (0 hablar/observar · 1 golpe normal · 2 ataque potente/carrera/combo · 3 esfuerzo máximo) y el **código** lo convierte en aguante (`effortStaminaCost`: 1/3/7/12). Además cada golpe recibido cansa (`staminaLossFromDamage`) y forzar un esfuerzo 2-3 con el depósito vacío te lastima (`overexertionHpLoss`, nunca letal por sí solo). **A más nivel aguantas más:** `levelResilience(nivel) = 1/(1+0.02·(nivel−1))` (suelo 0.5) reduce el daño recibido y todo coste de aguante, para jugadores, aliados y enemigos por igual. Los **enemigos y aliados NPC también se cansan** (`enemyStamina`) y rinden peor cansados; el narrador recibe la fatiga de ambos bandos (un rival fresco puede contraatacar bien contra uno exhausto). **Descansar y entrenar solo sin peligro** (`dangerBlockReason`: no con pelea pendiente, duelo, pelea en grupo, caza pendiente ni Buster Call en la isla).

**Técnicas** (`techniques`): lo que *describes* se convierte en un bono real.

| Técnica | Bono activo | Coste |
|---|---|---|
| Combate básico | — | 4 |
| Haki de Armadura | atk +0.2×nivel, def +0.15×nivel | 12 |
| Haki de Observación | def +0.15×nivel, vel +0.1×nivel | 8 |
| Haki del Rey (solo si lo posees) | atk +10, def +4 | 22 |
| Poder de la fruta | mitad restante de sus bonos × fase | 14 × (inicial 1.5 · avanzada 1 · despertar 0.75) |

Si no tienes ese poder o no alcanza la estamina, **se degrada en silencio a golpe básico** y el narrador lo cuenta como intento frustrado. Usar Armadura/Observación puede subir su nivel (prob. `0.35×(1−nivel/130)`, +1).

**Evolución de la fruta** (`fruit-mastery`): dominio 0–100 y bandera de despertar.
- **Inicial** (<35): poder ×0.6, técnicas caras. **Avanzada** (≥35): poder ×1, más barata. **Despertar**: solo con dominio 100 **y** ganar un combate al límite (contra un jefe, o con ≤25 % de vida); desbloquea los bonos `awakened` de la fruta y coste ×0.75.
- Dominio: `+2+INT×0.06` por combate usándola (rendimientos decrecientes); entrenar con ella da más. Sustituye la vieja regla “despierta a nivel 40”.
- **Haki del Rey:** no se entrena; tras una victoria al límite tiene `1 % + VOL×0.15 %` (máx. 8 %) de despertar.
- **Entrenar** (`trainCharacter`): Armadura, Observación o fruta (`focus` que indica el texto; “auto” elige lo más atrasado). Cooldown **30 min reales**. Haki: `2+VOL×0.08` × rendimiento decreciente `1−nivel/130`; 10 % de sesión nula, 5 % de gran avance ×3.

**Frutas del Diablo** (`devil-fruit-catalog`): **35 frutas** (22 únicas/singleton, 13 comunes). Las comunes **se duplican** (fila nueva por concesión); las singleton solo existen como una fila ligada a su dueño canon. Caen por eventos (probabilidad por plantilla). No poder nadar: evento “El mar no perdona” con −60 al modificador. Kairoseki: en prisión, fianza ×1.6 y −15 al rescate.

### 4.7 Exploración y eventos (`events`)
Plantillas por isla (o globales) filtradas por peligro; una tirada decide 4 niveles de resultado (crítico/éxito/fallo/crítico fallido) con rangos de berries/XP/recompensa/daño; pueden generar combate con un enemigo y jefe/Poneglifo. Sin combate, se aplica al instante y la IA narra (`narrateExplore`). Cada explorar: gasta estamina, decae el calor de Poneglifos (−3) y de rencores (−2) y tira emboscadas.

**Subir de nivel:** XP `100×1.35^(nivel−1)`; se gana explorando y peleando, **no** entrenando.

### 4.8 Economía (`economy`)
- Recompensa por victoria: `peligro²×1500 × penalización por nivel (≥0.25) × 4.5 si jefe`. Berries: `200+peligro×350` (×3 jefe).
- Precios: fruta en mercado negro `50 000 × multiplicador de rareza` (1, 2.2, 5, 12, 30, 80); arma `precio base × grado` (1, 3, 8, 20, 60, único 45).
- **Tienda:** 5 armas comunes (instancia nueva por compra) y meito legendarios únicos.
- **Armas únicas:** Wado Ichimonji, Enma, Shusui, Sandai Kitetsu, Yubashiri, Kabuto — una sola unidad en el mundo.

### 4.9 Muerte, prisión y Impel Down
- **Tirada de muerte** (`death`): `0.12 + max(0, peligro×2−nivel)×0.05 − RES×0.004 − VOL×0.003` (×0.4 sin permadeath), acotada 2 %–92 %. Si sobrevives: vida = `max(5, 10 % máx.)`. Muerte = permanente, noticia grave, y 30 % de que cada compañero muera.
- **Captura:** perder ante Marina/CP-0 (batalla de grupo o cacería) tiene **55 %** de captura en vez de solo herida.
- **Fianza** (`isBailAllowed`): `(500+peligro×400)×(1+nivel×0.15)`. **Prohibida** para piratas/cazadores con recompensa ≥ 10 M, revolucionarios con notoriedad ≥ 150 y en Impel Down.
- **Impel Down** (isla real: peligro 10, **nivel 45**, solo vía Enies Lobby): los muy buscados (pirata ≥100 M; revolucionario/cazador ≥700 de notoriedad) van allí, al **nivel 1–6** según recompensa (100 M, 300 M, 600 M, 1 000 M, 2 000 M, 3 000 M). Dificultad de rescate: `poder del captor×(1+0.3×nivel) + nivel×15`. Sin fianza. Un rescate fallido **hiere al rescatador un 40 % de su vida**; uno catastrófico lo encierra. El rescatado sale por contrabando a Loguetown. Marina y CP-0 nunca van a Impel Down.
- **Rescate** (`rescue`): tirada `poder del rescatador − nivel requerido − (15 si fruta)` vs 50; el aliado debe estar en la misma isla.

### 4.10 Multijugador
- **Tripulaciones** (`crew`) con **panel propio**: miembros con vida/aguante/Haki/fruta/arma en vivo, nakamas NPC, **invitaciones** (candidatos de tu isla o por nombre exacto, aceptar/rechazar/cancelar, caducan a las 24 h), unirse por código, expulsar (capitán), abandonar. Nombre por facción (Tripulación, Escuadrón, Célula, Unidad); **los cazarrecompensas trabajan siempre en solitario** (sin tripulación). **Bandera con imagen** subida por el capitán (PNG/JPG/WebP/GIF ≤200 KB, validada por sus bytes, nunca SVG). Las noticias son **globales**: cualquier jugador las ve, invitado o no.
- **Escena compartida** (`party`): compañeros de tripulación vivos, en la misma isla y no separados comparten una escena con **orden de turnos** (capitán primero) y **una sola llamada de IA por turno**. Se crea/disuelve perezosamente al consultar el personaje (sin cron). Separarse pide confirmación; se puede reunirse. Un combate personal ignora los turnos y se **retransmite ronda a ronda** al grupo.
- **Batalla de grupo** (`group-battle`, N vs N determinista): el retador propone emparejamientos 1-vs-1; oleadas de máx. 14; quien gana con >50 % de vida refuerza a un compañero (+20 % atk por refuerzo, máx. 3).
- **Duelos 1 vs 1** (`duel`): ambos escriben su movimiento; con los dos dentro el motor resuelve **a la vez** y la IA narra. Resolución con protección contra carreras. Máx. 12 rondas (después gana el de mayor % de vida).
  - **Amistoso:** consentido, **no letal**: vida = copia de la máxima, no toca la vida real; gasta estamina y hace crecer Haki/fruta; rendirse escribiéndolo.
  - **A muerte / Cacería:** vida real de partida; el perdedor pasa la **tirada de muerte** o es **capturado** si el vencedor es Marina/CP-0; el vencedor gana botín/notoriedad y la Marina/CP-0/cazadores cobran hasta 500 000 (10 % de la recompensa) por traer a un pirata; noticia grave. “Rendirse” no existe: es un intento de huida por velocidad (si falla pierdes la ronda).
  - **Hostilidad** (`hostility`): sin consentimiento entre facciones enemigas — Marina/CP-0 ↔ Pirata/Revolucionario, Pirata ↔ todos, Revolucionario ↔ Gobierno. Misma facción = solo con aceptación mutua. Protecciones: nivel < 3 intocable, solo a conectados (`lastSeenAt` < 3 min), sin repetir contra la misma persona en 30 min. El cazado tiene 5 min para responder: plantar cara o huir (prueba de velocidad).
- **Presencia:** lista “Aventureros en esta isla” (sondeo cada 10 s); prisioneros y rescate.
- **Viajes:** enfriamiento `6 + 2×peligro destino` minutos, coste 10 de estamina, requisito de nivel de la isla, y **una tripulación no zarpa** si un compañero en la misma isla tiene combate o duelo sin resolver.

### 4.11 Reputación y facciones (`progression`)
Escaleras por umbrales de recompensa/notoriedad, con noticia al cruzar un escalón (los ascensos de CP-0 no son públicos):
- **Pirata:** Sin recompensa → Novato → De interés → Superrookie → Amenaza → Objetivo prioritario → Candidato a Shichibukai → Emperador → Leyenda viviente → Rey Pirata en ciernes.
- **Marine:** Recluta … Almirante (12 000). **Revolucionario:** Simpatizante … Núcleo revolucionario. **Cazarrecompensas:** Novato … Azote de los mares.
- **CP-0:** Aspirante → CP10 → CP9 → CP8 → CP7 → CP5 → CP3 → CP1 → CP0 → Caballero Divino → Gorosei.

### 4.12 Poneglifos y persecución (`pursuit`, `grudge`)
- **4 Poneglifos de Ruta**, 2 colocados (Fragmento del Alba: Isla Cementerio/Barbanegra; Fragmento del Ocaso: Enies Lobby/CP-0). Se leen al vencer al guardián (perdones o remates) y guardan calor.
- **Calor de Poneglifos:** +50 por lectura (máx. 150), −3 por explorar; prob. de emboscada `min(35 %, calor/300)` de un Cazador de Poneglifos escalado a tu propia fuerza.
- **Rencor de NPC** (`Grudge`, por par NPC/personaje): huir de un subordinado de un actor del mundo +35, derrotarlo +20, perdonar −15 (máx. 150); prob. de emboscada `min(30 %, calor/350)`; la narración recuerda el incidente y a calor >100 el NPC puede amenazar con refuerzos (solo texto).

### 4.13 Mundo vivo y noticias (`world`, `world-tick`)
- **Tick perezoso** (sin cron) cada **30 min reales** desde cualquier petición: el motor elige plantilla y actor **respetando la facción** (un Almirante nunca “recluta piratas”); si nadie encaja, no hay noticia. Un actor ocupado (`busyUntil`) no puede estar en dos sitios.
- **Noticias con IA** (`narrateNews`): el motor fija categoría/actor/efecto; la IA solo redacta. Regla dura: **nunca** narrar la muerte, captura permanente o caída de un personaje canon con nombre.
- **Cartelera de recompensas** cada 6 h (`tickBountyDigestIfDue`) con cifras canon reales.
- **Severidad** de noticias: normal / digest / grave (muertes, capturas, Poneglifos, batallas, duelos a muerte).
- **Página `/news`:** agrupada por día (Hoy/Ayer/fecha), filtros por categoría, paginación por cursor, tratamiento visual por severidad.
- **Contenido:** ~41 actores canon (Yonko, Almirantes, Shichibukai, Revolución, Cipher Pol, Sombrero de Paja…) con facción, rango, recompensa canon, fruta canon, personalidad; ver `WORLD_LORE.md`.

### 4.15 Fase 2: el universo completo
- **Peleas conjuntas** (`engine/joint-fight`, `game/joint-fight`): N jugadores + NPC aliados contra un enemigo escalado (`scaleEnemyForGroup`: HP ×(1+0,75·(n−1))); ronda simultánea, la resuelve el último en enviar (reclamo atómico); 120 s y quien tarda guarda. Tipos: party / poneglyph / conquest / raid. Al ganar, caídos salen vivos al 10 % de vida.
- **Guardianes y sigilo** (`engine/guardian`, `game/guardian`): el guardián en casa (`isActorHome`) se encuentra en persona un 75 %, con stats por `powerLevel`; si no, un subordinado. Sigilo = tirada (limpio / notado / visto / atrapado). Derrotado, se retira 6 h y guarda rencor (`actor_defeat`).
- **Dominios** (`Territory`, `engine/territory`, `game/territory`): ejército → comandantes → dueño como peleas conjuntas; voto ponderado por aportación (desempate: golpe final → aportación → id); título, tributos, guarnición (−25/12 h) y retoma del antiguo poder.
- **Impel Down** (`engine/escape`, `engine/buster-call`, `game/buster-call`): fuga por niveles con enfriamiento 30 min y alerta; Buster Call (3 oleadas como peleas conjuntas, 40 min; si cae, bombardeo 70 % + tirada de muerte + isla perdida).
- **Tiempo real** (`realtime.ts`, ruta `stream`): hub SSE en memoria (un solo proceso) + `notify*`; el cliente recarga al recibir y el sondeo pasa a 30 s.
- **Mundo**: 26 islas (11 nuevas), 4 Poneglifos de Ruta colocados, isla de marea (Isla Abismo, ventanas de 3 h), Laugh Tale exige los 4 (`knowsTheRoad`), 24 frutas únicas, Gorosei y Rey Sin Nombre como `WorldActor`.
- **Final** (`engine/raid`, `game/raid`, `game/endgame-lore`, `game/alliance`): al pisar Laugh Tale se revela "La Crónica del Mar" (`knowsTruth`); coalición ≤20 + hasta 4 aliados NPC por confianza (`Alliance`, ≥60), 4 fases (`RAID_PHASES`) como peleas conjuntas con tope de 6 ataques enemigos; voto del Rey de los Piratas; `WorldClock.era` = "Nueva Era", título "Rey de los Piratas"; enfriamiento 7 d (victoria) / 24 h (derrota).
- **Consecuencias** (`Consequence`, `engine/consequence`, `game/consequences`): perdonar/matar a un enemigo con nombre deja un hilo (favor, traición, vengador, tributo), hasta 3 etapas.
- **Mercado negro** (`engine/black-market`, `game/black-market`): 4 islas, género rotativo cada 3 h, riesgo de trampa creciente por trato.
- **Misiones y panorama** (`Mission`, `IslandBriefing`, `engine/missions`, `game/missions`, `narrateIslandBriefing`): cada isla (y la de inicio de cualquier facción) da 3 misiones escaladas por nivel y un panorama narrado por la IA (con texto estático de respaldo); completarlas da berries/XP y confianza (`Alliance`).

### 4.16 Fase 3: herramientas fuera de rol, mundo vivo y eventos mundiales (2026-09-24)

**Fuera de rol** (`game/ooc`, `ai/ooc*`, `OocPanel`): chat efímero con la IA (no se guarda nada; sirve también para preguntar cómo funciona el juego), que solo **propone** una acción de una lista cerrada y tú confirmas: renombrar personaje/tripulación, deshacer la última respuesta, rollback, reparar valores, tono del narrador (equilibrado/letal/historia), indicaciones permanentes, pactos de escena (p. ej. un 4 vs 4 que el narrador monta dentro del rol) y reportar fallos. Todo se revalida en servidor.

**Rollback = una sola línea temporal.** Puntos de restauración automáticos (≥10 min entre ellos, más uno al crear el personaje) y manuales. Antes de volver hay una **alerta** que cuenta qué se borrará y qué valores cambian; la API exige confirmación explícita. Se restauran números **y la memoria del narrador**, se borra la escena/bitácora/noticias propias/nakamas/misiones posteriores y se incrementa `timelineEpoch`, de modo que ningún resumen de IA "en vuelo" pueda resucitar lo descartado. Reglas: el muerto no vuelve (muerte permanente), el preso tampoco, ni en duelo o pelea en grupo, máximo 3 al día; el equipo no se deshace y los berries solo se restauran si el equipo no cambió.

**La IA conoce lo que cada uno puede hacer.** Ficha real del jugador (Haki, fruta y fase, arma, fatiga, aliados) y **repertorio de cada enemigo** (Haki, fruta y fase, arma, técnicas; los canon lo declaran, los aleatorios lo derivan de su nivel, con frutas a partir de la Grand Line). **Todo combatiente que la IA controla (enemigos y aliados NPC) juega a ganar** con todo su repertorio y nada fuera de él; el motor sigue decidiendo quién acierta.

**Nakamas NPC reales:** se reclutan con el texto ("Jorge, únete a mi tripulación"), decide una tirada de persuasión, máximo 3, **siempre a tu nivel**, con rol y habilidades que se desbloquean a los niveles 1/5/12.

**Mundo vivo.** Cada personaje canon tiene siempre una **ubicación** (`currentIslandId`; puede moverse en secreto → "Ubicación desconocida"), se mueve por islas vecinas con el tiempo, y el narrador lee en cada escena **quién está en tu isla y cerca** más los eventos mundiales en curso. Toda noticia muestra **dónde ocurrió**.

**Eventos mundiales.** Sagas lentas de 6 capítulos (rumor → movilización → primer choque → escalada → asedio → punto de no retorno) separados por horas, cada uno una noticia con lugar y con el resumen de los anteriores como memoria. **Hasta el veredicto nadie muere ni es capturado.** En el último capítulo el evento se detiene y solo el dueño decide en `/admin` (doble confirmación): aprobar → el personaje pasa a DECEASED o CAPTURED (preso en Impel Down); rechazar → sobrevive en la sombra; en ambos casos se publica el desenlace. Administrador = usuario exacto en `ADMIN_USERNAMES` (nombres que solo difieren en mayúsculas se rechazan al registrarse). Los jugadores pueden **intervenir** en el lugar, desde el capítulo 3 y con nivel suficiente: defender, apoyar al agresor o pelear contra todos, contra una vanguardia (nunca el canon en persona); con 3 defensores victoriosos el objetivo se salva sin veredicto.

**Códice** (`/codex`): ~126 personajes con recompensa, fruta y fase, arma, estadísticas, Haki, habilidades, personalidad y ubicación; los ya fuera de juego (fallecidos/derrotados/retirados) viven en "historia" y no actúan. 7 islas nuevas (Orange Town, Villa Syrup, Ohara, Marineford, Dressrosa, Zou, Isla Egghead).

**Robustez** (a raíz del historial de una cuenta real): idempotencia por `requestId` (un reenvío nunca ejecuta el turno dos veces) y una acción a la vez por personaje; error visible + recarga si se corta la conexión; el turno del grupo se libera si la acción falla; los ticks del mundo van en segundo plano y protegidos contra simultaneidad.

### 4.14 Islas (33)
Fase 3: Orange Town y Villa Syrup (East Blue, nivel 1), Ohara (Paradise, 14), Marineford (26), Dressrosa (28), Zou (30) e Isla Egghead (36). Ver 4.15 para las 11 islas de la fase 2 (Isla Drum, Skypiea, Water 7, Archipiélago Sabaody, Isla Gyojin, Punk Hazard, Whole Cake, País de Wano, Isla Abismo, Mary Geoise, Laugh Tale). East Blue: Pueblo Foosha, Cuartel Marine G-5, Isla Baltigo, Isla Gecko, Villa Shimotsuki, Restaurante Baratie, Isla Conomi (Arlong), Loguetown, Reverse Mountain. Grand Line/Nuevo Mundo: Whisky Peak (peligro 6, nivel 8) → Little Garden (7, 10) → Alabasta (8, 12) → **Isla Cementerio** (10, nivel 30, Barbanegra) y **Enies Lobby** (10, nivel 35, CP-0) → **Impel Down** (10, nivel 45). El nivel mínimo se comprueba al zarpar.

## 5. Sistema de IA

- **Modelos** (`models`): lista por orden `openrouter/free` → `openai/gpt-4o-mini` (de pago, respaldo) → 3 modelos gratuitos con nombre. Sobrescribible con `OPENROUTER_MODELS`.
- **Cliente** (`openrouter-client`): los **dos primeros modelos compiten a la vez** (gana el primero en responder; el otro se aborta); el resto, en secuencia. **Presupuesto total** de 2× el timeout por modelo; un intento con <1 s restante se salta. Cada fallo se registra en `ErrorLog`. Validación de salida (rechaza vacío, moderación filtrada, rechazos).
- **Narradores** (siempre devuelven algo; texto estático de respaldo): explorar, combate, intro de amenaza, escena, escena de grupo, duelo, noticias, cartelera. Timeout 30 s por modelo, hasta **2500 tokens** de salida; el prompt pide **extensión cuando la escena es interesante** (5–8 párrafos) y siempre deja margen para responder.
- **Clasificador:** 8 s, temperatura 0.1, JSON estricto; contexto = último mensaje del narrador.
- **Memoria:** `memorySummary` (≤1500 caracteres) y **compactación silenciosa** (`scene-compaction`): cuando se acumulan ≥22 mensajes sin compactar, los antiguos (menos los 12 recientes) se resumen **en segundo plano** en `memorySummary` (personaje) o `Party.memorySummary` (grupo) y se marca `sceneCompactedUntil`; el jugador no nota nada y la transcripción en pantalla no se toca. También se actualiza tras combates y decisiones de misericordia.

### 4.17 Pulido del narrador (2026-09-24)

- **Causa real del "me ignora"** (reporte de Kirito en producción): los dos mensajes de un intercambio se guardaban con el mismo `createdAt`, el transcript se barajaba y el narrador contestaba al mensaje anterior; además en `explore` la acción del jugador iba como "contexto" débil. Ahora `exchangeRows` sella al jugador 5 ms antes que al narrador, y `currentActionBlock` (`engine/narration-length.ts`) pone la ACCIÓN ACTUAL al final de cada prompt, literal y sin ampliarla.
- **Extensión dinámica** (`planLength`): breve/media/larga según lo que escribió el jugador y el tipo de beat (ronda de combate corta, final de pelea o escena grupal con más margen), tope ~300 palabras, `maxTokens` derivado; lenguaje sencillo, sin florituras.
- **Modelo**: `openai/gpt-4o-mini` (de pago) va primero y los gratis solo entran de respaldo tras `hedgeDelayMs` (7 s) o si el primero falla; antes `openrouter/free` respondía con un modelo aleatorio distinto cada vez.
- **Limpiar escena** (`clear_scene`, `Character.sceneClearedAt`): vacía pantalla y ventana reciente del narrador, conserva `memorySummary` y pliega en segundo plano lo que faltaba por resumir. Un rollback lo reinicia.
- **Bug del historial**: el estado del personaje cargaba las 60 mensajes MÁS ANTIGUOS; pasada la escena 60 la pantalla dejaba de mostrar lo nuevo. Ahora carga los 60 últimos.
- **Rondas sin reloj**: las peleas conjuntas ya no cubren al que tarda 2 minutos; cada quien responde a su ritmo. Las peleas en vivo (solo, duelos, grupo) NO tienen tope de rondas: terminan por vida, huida o rendición (`MAX_ROUNDS` = 60 solo acota las simulaciones automáticas sin jugadores).
- **Móvil**: los paneles modales tenían hijos que se encogían y se solapaban, y la cabecera de la ficha no envolvía (ensanchaba la página a 590 px). `scripts/polish-ui-check.mjs` mide 390 px en todas las pantallas.

### 4.18 Atributos, inventario, estilos, coliseo y otra oleada canon (2026-09-24)

- **Atributos** (`engine/attributes.ts`, `game/attributes.ts`, `Character.attributePoints/attrLevelGranted`): 2 puntos por nivel, concedidos de forma perezosa e idempotente al leer el personaje (también cubre personajes antiguos); reparto validado (enteros, sin negativos, tope `12+3*nivel`), carrera doble-gasto cerrada con `updateMany` sobre el saldo. Durabilidad +3 vida máx por punto, Voluntad +2 aguante máx; el Intelecto suma un empujón acotado a la táctica (`intellectTacticEdge`). El narrador lee los cinco atributos en palabras.
- **Inventario** (`engine/inventory.ts`, `game/inventory.ts`, `InventoryItem`): catálogo de 11 objetos, mochila de 24 huecos con apilado, uso (vida/aguante/persecución/botín), venta al 40 %, mercader con recargo por peligro, botín al explorar con éxito. Bloqueado en peleas. `Weapon.ownerId` ya no es único: un personaje puede tener varias armas (era un bug latente que rompía la tienda y la hoja de contrabando).
- **Frutas**: nunca se comen solas. Encontrar/comprar/ganar una crea una fila `DevilFruit` sin dueño y la guarda como objeto de la mochila (`effectJson.fruitId`); `eatFruit` (confirmación en la UI, una sola fruta, borrado del objeto como guarda contra doble clic), `sellFruit`, `grantCatalogFruit` (premios). El nombre se muestra siempre.
- **Estilos de combate** (`engine/styles.ts`, `engine/actor-styles.ts`, `game/styles.ts`, `CharacterStyle`, `Character.styleFocusId`, `Weapon.wielded`): 15 estilos aprendibles (Ittoryu→Nitoryu→Santoryu, Pierna Negra, Rokushiki, Esgrima Marina, Puño del Acorazado, Ryusoken, Newkama Kenpo, Karate Hombre-Pez, Hasshoken, Electro/Sulong, Kitsunebi, Dials, estocada) y 6 solo de personajes; maestría 0-100 con 5 rangos y técnicas por umbral; escuela por isla + facción + nivel + atributos + estilo previo + matrícula. Reglas de armas (0, 1, 2 o 3 empuñadas): sin el estilo las armas extra valen 25 %, con él hasta 100 %. La mitad pasiva de sus bonos va siempre; el resto se gana usando técnicas (`TechniqueId "style"`, coste de aguante, crece con el uso). `Combatant.pierce` ignora parte de la defensa (Hasshoken, Ryusoken...). 56 personajes canon tienen estilo; sus técnicas están en su kit (el narrador y los enemigos las usan) y el códice las muestra.
- **Coliseo de Dressrosa** (`engine/coliseum.ts`, `game/coliseum.ts`, `Tournament`, `TournamentEntry`, `WorldClock.lastTournamentAt`): calendario perezoso en `tickWorldIfDue` (anuncio cada ~48 h, inscripción 3 h, rondas cada 15 min, `nextAction` puro y testeado). Solo se inscribe quien esté en Dressrosa y siga allí al cerrar; sorteo al azar cada ronda; gladiadores (los personajes canon presentes + inventados) rellenan a 4/8/16; combates no letales sobre copias de vida completa (`runBout`); estrategia opcional que sesga la tirada; un jugador que abandona la isla pierde por incomparecencia; sin inscritos humanos se cancela. Premios (arma, fruta o oro) se deciden al anunciar y aparecen con su nombre real en Noticias; el campeón los recibe en su Inventario. Cada ronda: noticia (categoría "Coliseo") y línea en la bitácora de cada participante.
- **Mundo**: 6 islas nuevas (Jaya, Long Ring Long Land, Thriller Bark, Amazon Lily, Kuraigana, Elbaf → 39), ~55 personajes nuevos (los 5 Gorosei completos, Dragones Celestiales, oficiales de la Marina, tripulaciones de Big Mom/Barbanegra/Kaido, gente de cada isla → 181 en total) y **Kaido y Big Mom reactivados** (Emperadores en sus territorios, sin morir jamás fuera de un evento mundial con veredicto del dueño). Reubicaciones canon (Hancock → Amazon Lily, Mihawk → Kuraigana, Moria → Thriller Bark).
- **Eliminado**: el evento marino "El mar no perdona" (eliminado el 2026-09-24), que podía matar a quien tuviera fruta.

### 4.19 Viajes largos, Yonko de jugador y comandantes (2026-09-24)

- **Viajes largos** (`engine/voyage.ts`, `game/voyage.ts`, `Character.voyageToIslandId/voyageFromIslandId/voyageArrivesAt/voyageAmbushJson`): desde el nivel 20 se puede navegar a cualquier isla alcanzable (BFS sobre las conexiones); 5 min por salto, máximo 1 h. Los cruces a islas vecinas siguen siendo directos con su cooldown. La llegada se resuelve de forma perezosa (`settleVoyage`, en `loadCharacterOrThrow` y en el GET, race-safe con `updateMany`); mientras se navega, explorar/entrenar/descansar/zarpar dan error (`assertNotAtSea`). El personaje sigue en la isla de origen hasta llegar. Menú: `GET /api/characters/[id]/voyage` (`getVoyageOptions`: tiempo, riesgo, bloqueos por nivel/marea/Poneglifos) y panel `VoyagePanel.tsx` (botón "Rumbo", móvil).
- **Emboscadas en el mar**: al zarpar de un viaje de 2+ saltos se tira `rollSeaAmbush` (12 % + 7 % por salto extra, tope 55 %); el resultado se guarda y salta al llegar a puerto como un `PendingEncounter` real escalado al viajero (`seaAmbushPower` 0.9-1.3), con enemigos según facción.
- **Yonko en las noticias**: `isYonkoClass` (título Yonko/Emperador o recompensa >= 1.000 M) hace que cada salida y llegada sea noticia mayor ("En el mar, entre X y Y" / la isla).
- **Comandantes con perfil**: `NPCCompanion.profileJson` (`epithet`, `abilities`, `styleId`, `attrs`) sobreescribe las habilidades del rol y suma atributos (`companionSheet(..., profile)`); el narrador y las peleas conjuntas los conocen.
- **Isla del Toro Negro** (Nuevo Mundo, peligro 8, nivel 30, conectada a Elbaf y Dressrosa) y `scripts/make-yonko.ts "<personaje>"`: herramienta del dueño, idempotente, que deja a un pirata como Yonko (atributos al tope de su nivel, 3 Hakis, copia despertada de la Ope Ope no Mi, Nitoryu al máximo con dos espadas, recompensa 2.000 M, isla propia como `Territory` con guarnición completa y tres comandantes con nombre). La Ope Ope de Law sigue siendo suya: es una copia (fila distinta; la semilla elige siempre la más antigua).
- **Coliseo**: un torneo cada ~48 h (antes 24).
- **Imperio** (botón "Imperio", `engine/empire.ts`, `game/empire.ts`, `api/characters/[id]/empire`): panel con tus dominios (guarnición, soldados aproximados, cuenta atrás hasta que caiga sin refuerzos, tributos acumulados) y tus nakamas/comandantes. Cada uno puede salir en una **misión** (patrullar un dominio +20 guarnición, cobrar tributos, explorar el mar para XP; 45-90 min). El resultado lo tira el motor según su poder y el peligro; si sale mal vuelve herido, nunca muerto. Un nakama en misión no combate a tu lado. La misión vive en `NPCCompanion.profileJson.errand` (sin cambio de esquema) y se liquida de forma perezosa y sin doble pago.
- **Combate sin dados — el árbitro IA**: en combate solo, duelos 1 contra 1 y peleas conjuntas ya no se tiran dados. Un árbitro (IA) juzga cada intercambio con el nivel, la vida, el aguante, el cansancio y todo el repertorio real de cada combatiente (Haki, fruta, arma, estilo, habilidades) y con lo que el jugador describió, y decide la narración y cuánta vida y aguante pierde cada bando. El código solo lo acota (nadie pierde más de la mitad de su vida máxima en un intercambio; quien abre la pelea no puede ser herido en ese primer veredicto) y lo aplica. Reglas de juego limpio: el ataque nuevo del rival se ANUNCIA pero no se resuelve; en tu siguiente mensaje decides cómo lo recibes (bloqueas, esquivas, desvías, aguantas). El rival SIEMPRE reacciona (estado visible, si contraataca) y solo se hiere lo que se ataca de verdad. Si la IA no responde, no cambia nada (tu movimiento no cuenta). Siguen con azar: la huida, la tirada de muerte al llegar a 0 de vida y las simulaciones automáticas.
- **Duelos entre jugadores**: la IA solo arbitra vida y aguante (2-4 frases neutras) y no decide nada por nadie; hay que esperar a que los DOS muevan, y solo te hieren si tu propio texto lo permite. Todos los duelos tienen el botón «Perdí»: en un amistoso gana el otro y no pasa nada más. En un duelo a muerte además existe «Intentar huir» (describes cómo; el rival lo ve y decide si te deja) y, cuando alguien cae o se rinde, el vencedor elige entre matar (muerte real), capturar (Marina/CP-0: cárcel, Impel Down según recompensa; los demás: entregarlo a la Marina y cobrar) o perdonar. A un Marina/CP-0 no se le puede capturar. Al terminar, la IA escribe la crónica del duelo en las noticias con el lugar. Lo pactado fuera del juego es lo que manda.
- **Den Den Mushi**: chat interno por facciones (piratas solo con piratas, Marina con Marina, etc.), 400 caracteres, sin spam, no disponible para presos ni muertos.
- **Tiendas por isla**: `ItemDef.soldAt` (`engine/inventory.ts`, `specialtyIdsFor`): 7 especialidades locales (Alabasta, Baratie, Amazon Lily, Zou, Wano, Isla Gyojin, Toro Negro) que el Mercader vende solo allí, marcadas "especialidad local"; nunca caen como botín (`minDanger` 99).
- **Torneo de estilos** en el Coliseo (`kind: "styles"`, premio `style`): el campeón aprende el estilo sin escuela ni matrícula (maestría mínima 30) o sube +25 si ya lo conocía.
- **Clases en la escena**: escribir "Maestro, quiero aprender Santoryu" (`detectStyleLesson`, determinista: verbo de clase + nombre de estilo) matricula al personaje por la vía normal (`learnStyle`, mismos requisitos) nombrando a un maestro canon presente si lo hay; si no cumple los requisitos se le dice por qué y no se cobra nada.
- **Saga de los Emperadores**: Kaido y Big Mom son protagonistas preferentes (50 %) de los eventos mundiales (`FEATURED_ACTOR_NAMES`); siguen sin morir ni ser capturados sin el veredicto del dueño en `/admin`.
- Verificado con `scripts/voyage-check.ts` (DB) y `scripts/voyage-ui-check.mjs` (navegador a 390 px).

## 6. Modelo de datos (Prisma)

`User` · `Character` (stats, haki, fruta, arma, isla, tripulación, estamina, dominio de fruta, `lastTravelAt`, `lastSeenAt`, `sceneCompactedUntil`, `memorySummary`, `poneglyphHeat`, `partyId`…) · `Crew` · `Party`/`PartySceneMessage` · `DevilFruit` (`isSingleton`) · `GroupBattle`/`GroupBattleParticipant` · `PendingEncounter` (fases threat/fighting/victory) · `Duel`/`DuelMessage` (`lethal`, `hostile`) · `Imprisonment` (`cellLevel`) · `NPCCompanion` · `Weapon` · `InventoryItem` · `Island` · `Poneglyph` · `EventTemplate` · `GameLogEntry` · `BountyLogEntry` · `SceneMessage` · `NewsItem` (`severity`) · `WorldActor` (facción, rango, recompensa canon, fruta canon) · `Grudge` · `WorldEventTemplate` · `WorldClock` · `ErrorLog` · Fase 3: `Checkpoint`, `OocReport`, `CrewInvite`, `WorldArc` (+ `WorldActor.status/statsJson/abilitiesJson/currentIslandId/locationHidden`, `NewsItem.locationName/arcId/arcStage`, `Character.narratorTone/oocNotes/timelineEpoch`, `Party.scenePact`, `Crew.flagImage`, `NPCCompanion.personality`).
Convenciones: los ids de personaje en `Crew.captainId`, `GroupBattle`, `Duel`, `Grudge` son **strings sin FK** (validados en código); `Weapon.name` y `DevilFruit.name` no son únicos (instancia por concesión).

## 7. API

| Ruta | Función |
|---|---|
| `POST /api/auth/{register,login,logout}`, `GET /api/me` | Sesión y lista de personajes |
| `POST /api/characters` | Crear personaje |
| `GET/DELETE /api/characters/[id]` | Estado completo (con latido de presencia, grupo, duelo, estamina) / borrar |
| `POST …/actions` | Texto libre (`{freeText}` ≤6000) o acciones explícitas (explorar, entrenar, descansar, viajar, luchar, huir, misericordia, confirmar/reunirse al grupo) |
| `POST …/duel` | `challenge` (con `lethal`), `respond`, `cancel` |
| `POST …/crew`, `…/battle` | Tripulación y batallas de grupo |
| `POST …/prison` | Fianza / rescate |
| `GET/POST …/shop`, `POST …/equip` | Tienda y equipamiento |
| `GET /api/news` | Noticias (cursor, categoría; cada una con `locationName`); los ticks del mundo van en segundo plano |
| `GET/POST …/ooc` | Fuera de rol: resumen, chat (`chat`), aplicar propuesta (`apply`), puntos (`checkpoint`, `delete_checkpoint`), `rollback_preview` y `rollback` (exige `acknowledged`) |
| `GET/POST …/crew` | Invitaciones y candidatos (GET) · crear, unirse, invitar, responder, cancelar, expulsar, despedir nakama, `set_emblem`, abandonar |
| `POST …/world-event` | Intervenir en un evento mundial (`defend`/`assist`/`chaos`) |
| `GET /api/crews/[id]/emblem` | Bandera de una tripulación (imagen) |
| `GET /api/world-events` · `GET /api/codex` | Eventos mundiales públicos · códice de personajes |
| `GET/POST /api/admin/world-arcs` | Solo el dueño: eventos abiertos, `decide` (permitir/rechazar), `advance`, `cancel` |

Errores tipados (`GameActionError`, `DuelError`, `CrewError`, `BattleError`, `PrisonError`, `UnauthorizedError`) → códigos 4xx; el resto → `logError` a la tabla `ErrorLog` + 500.

## 8. Interfaz

- `/` acceso y lista de personajes (borrar con confirmación) · `/create` facción + arquetipo · `/news` periódico.
- `/play/[id]`: cabecera con título de facción; panel de **duelo/cacería**; cuadro de texto libre con ayuda; **Escena** (o **Escena compartida**) con burbujas que respetan saltos de línea; barra de vida del enemigo y decisión de perdonar/rematar; panel de estado (vida, **estamina**, berries, recompensa/mérito, calor), atributos y Haki, **equipo con dominio de fruta**, tripulación, aventureros de la isla (**Retar a duelo / Cazar a muerte**), prisioneros, retos de batalla, viajes, bitácora y modal “Mapa y Guía”.
- **Fase 3:** botón **Fuera de rol** (cabecera y accesos en escena, duelo y pelea en grupo), **panel de Tripulación**, barra de experiencia, panel de **evento mundial** cuando estás en su lugar, `/codex` (Códice), `/news` con sección **Eventos mundiales** y pines de ubicación, y `/admin` (solo el dueño).
- Tema oscuro pirata/pergamino: Cinzel (títulos) y Crimson Pro (texto). Todo el texto para jugadores en español.

## 9. Calidad y verificación

- **480+ pruebas unitarias** (Vitest): motor, prompts, clasificador, compactación, viajes, hostilidad, Impel Down.
- `npx tsc --noEmit` limpio antes de dar nada por terminado.
- **Verificación en navegador real** con Playwright y la IA de verdad: `ai-e2e-smoke`, `crew-smoke`, `battle-smoke`, `party-multiplayer-smoke`, `combat-rounds-check`, `roleplay-attack-check` (el bug del bar), `duel-smoke`, `ooc-crew-ui-check`, `world-ui-check`, `check-news-page`, `check-map-page`…
- **Comprobaciones directas** (tsx contra la BD de desarrollo): `hunt-check` (cacería y protecciones), `impel-check`, `compaction-travel-check`, `world-news-check`, `grudge-check`, `prison-logic-check`, `delete-character-check`, `ooc-rollback-check` (rollback = una línea temporal), `world-arcs-check` (76 comprobaciones del mundo vivo y los eventos). **Regresión completa:** `node scripts/run-all-checks.mjs` (resultado en `shots/regression.log`).
- Tras verificar, se resetea la BD local (`npm run db:reset`).
- Trampas encontradas construyéndolo (para no repetirlas): un `\b` de un script Python quedó como byte de retroceso dentro de una expresión regular (lo dejó muerto sin errores); `beforeEach(() => mock.mockReset())` **devuelve** el mock y Vitest lo ejecuta como limpieza; tras editar con scripts, buscar caracteres de control.

## 10. Lo que NO está hecho (hoja de ruta)

Las fases 2 y 3 están completas (ver 4.15 y 4.16). Pendiente: balanceo con datos de juego reales (final, territorios difíciles, ritmo de eventos mundiales), un modo de mundo instanciado por jugador (hoy el mundo es único y compartido; solo el personaje, su escena y su memoria son propios), maestros de técnicas, subastas de frutas y coliseo sin permadeath.

## Sin dados en ningún ámbito (2026-09-25)
No queda ninguna tirada: juez/árbitro IA para todo resultado (explorar, huida, muerte a 0 de vida, sigilo, fugas, reclutar, simulaciones, Coliseo, 2v2/4v4); el código solo limita y aplica. Sustituye cualquier mención anterior a azar/dados en este documento. El Coliseo aplaza una ronda mientras un competidor esté en una pelea propia; el rival ataca con secuencias variadas y se adapta.

## Finalizar pelea (2026-09-25)
Botón/enlace en el panel de pelea contra un NPC ("¿La pelea se atascó o ya terminó? Finalizarla"). La IA lee toda la pelea y decide ganó / perdió / sin ganador; el código solo acepta victoria o derrota si el perdedor está a la mitad de vida o menos. Sigue los finales normales (perdonar o rematar, destino, o cierre sin premios). La vida de los NPC no se muestra en ninguna pantalla.
