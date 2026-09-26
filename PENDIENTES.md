# Pendientes y mejoras (lista viva — actualizar en cada sesión)

Última actualización: 2026-09-26. Marca con [x] lo hecho.

## Hecho el 2026-09-26
- [x] Guerras del mundo declaradas por el propio canon (Revolución, Justicia, Emperadores, Marina contra un Yonko), cada ~4 días, sin que un jugador tenga que ocupar un puesto primero. Los jugadores asaltan o se alistan desde Poder → Guerra.
- [x] Lore de los Poneglifos evolucionado: lengua antigua estudiada en Ohara, calcos si no sabes leer (descifrables después o entregables a un compañero), 6 Poneglifos de Historia nuevos con capítulos de lore reales.
- [x] Contratos de facción: cada isla también da un encargo de tu propia bandera, que paga en tu moneda propia.
- [x] "Mi camino": panel que dice, según tu estado real, qué hacer a continuación.
- [x] Panel de administración: guerras (forzar una, correr un frente, forzar el final), puestos de mando (forzar un desafío, resolver un duelo), y una caja de herramientas del jugador (ajustar estadísticas, teletransportar, curar, liberar, control de isla, dar objeto/fruta).
- [x] **Arreglo urgente en vivo**: el narrador inventaba guardias, tramas y misiones enteras por falta de contexto de cada isla — ahora cada una de las 47 islas tiene una guía fija (lugares, historia, costumbres) que la IA debe respetar. Desplegado solo, antes que el resto.
- [x] Arreglado: en la escena compartida, cuando alguien exploraba, al resto de la tripulación solo le llegaba un resumen de una línea (se perdía la escena real).
- [x] Arreglado: el orden de turnos en la escena compartida no se respetaba de verdad (solo "narrar" pasaba por la ronda). Ahora toda acción respeta el turno, en bucle.
- [x] Nuevo: se puede cancelar una pelea que aún no empezó (fase de amenaza), no solo una ya en curso.
- [x] GitHub Pages (`docs/guia.html`) actualizada: escaleras de rango corregidas (Almirante/Comandante/Gorosei ya no son mérito automático) y sección nueva de puestos de mando, guerras del mundo, lengua antigua y contratos de facción.
- [x] Desplegado a producción (esquema + resembrado de las 6 piedras de Historia + código), confirmado `live`.

## Decisiones del dueño (reglas fijas)
- [x] Nada de dados en ninguna parte: juez/árbitro IA decide; el código solo limita y aplica.
- [x] Solo IA de pago en OpenRouter (DeepSeek V3.2 primero, gpt-4o-mini de respaldo (solo si DeepSeek falla o se atasca 40 s)). Nunca modelos gratis.
- [x] La vida de los NPC/rivales NO se muestra ni se escribe en cifras: la decide y cuenta el árbitro. Solo se ve la vida y la fatiga de los usuarios.
- [x] Tiempos de respuesta generosos: 24 h (rondas del Coliseo esperan a quien pelea, duelos/peleas conjuntas abandonadas, respuesta a una caza).
- [x] Barbanegra tiene DOS frutas (Yami Yami + Gura Gura) en su ficha.
- [x] Botón "Finalizar pelea" contra NPC (la IA lee la pelea y decide; tope: solo si el perdedor está a media vida o menos).
- [x] El rival pelea como estratega: secuencias variadas, continuidad, se adapta.
- [x] El árbitro recuerda todo el combate (registro completo de rondas) para no olvidar heridas ni trucos.

## Hecho el 2026-09-25 (noche)
- [x] Chat de tripulación (pestaña en el Den Den Mushi).
- [x] Sucesos del mundo: uno nuevo cada 24 h inventado por la IA; el dueño puede proponer ideas.
- [x] Eventos para principiantes (12 frutas únicas inventadas, juez IA, sin límite para terminar, ventana de inscripción de 6 h, todo en las noticias).
- [x] Insignias de "nuevo" en Noticias, Den Den Mushi, Eventos e Inventario.
- [x] Panel de administración ampliado (reportes, anuncios, eventos, proponer sucesos, iniciar eventos mundiales, errores).
- [x] Códice: pestaña Jugadores.
- [x] Nakamas: elegir quién te acompaña y darles misiones desde el panel de tripulación.
- [x] IA fuera de rol actualizada con las novedades.
- [x] Narrador: ve las frutas guardadas en la mochila y no da objetos por narración.

## Verificación pendiente
- [ ] Regresión completa con todo lo nuevo (`node scripts/run-all-checks.mjs`); solo se corrió cada comprobación nueva por separado.
- [ ] Registro/auditoría de acciones importantes (más allá de noticias y del Códice de jugadores).
- [ ] Coliseo: revisar el primer evento real tras los cambios de esperas.
- [ ] Regresión completa (`node scripts/run-all-checks.mjs`) con la base limpia tras los últimos cambios.
- [ ] Probar en vivo un combate largo (10+ rondas) y ver que el rival cambia de táctica y recuerda heridas.
- [ ] Probar en vivo el Coliseo aplazando una ronda con un jugador en pelea.
- [ ] Vigilar el gasto en OpenRouter (saldo ~9 USD al 2026-09-25).

## Mejoras de calidad
- [ ] Coliseo: convertir el combate del jugador en un duelo en vivo (hoy lo resuelve el juez con hojas de estadísticas).
- [ ] Barbanegra: soportar dos frutas como dato real (hoy es texto en habilidades; el códice solo muestra una).
- [ ] Rival que recuerda además su "personalidad de combate" entre peleas (memoria de rencor más rica).
- [ ] Ajustar prompts según los próximos reportes de jugadores (`/admin` → reportes).

## Diseño / contenido para más adelante
- [ ] Poneglifos: el poseedor real de un Poneglifo de Ruta pelea según dónde esté (hoy siempre un subordinado) — sigue sin construirse; lo nuevo del 26 fue la lengua antigua, los calcos y los 6 Poneglifos de Historia, no esto.
- [x] Conquista de territorios de un Yonko y reparto entre varios jugadores.
- [x] Ruta de Yonko por mérito, desafío en persona a un Yonko canon (veredicto del dueño para su muerte o captura), Shichibukai para piratas, guerras contra la Marina y entre Yonko, reacción del mundo y figuras mundiales en las noticias (2026-09-25).
- [x] CP-0 empieza en Tequila Wolf (isla de nivel 1). 7 islas y 33 personajes canon nuevos.
- [x] Puestos de mando (Almirantes, mando revolucionario, Gorosei) ganados por desafío, no por mérito (2026-09-26, sesión anterior).
- [x] Guerras que el propio canon declara solo (Revolución, Justicia, Emperadores, Marina), sin que un jugador tenga que ocupar un puesto primero (2026-09-26).
- [ ] Raid final contra el gobernante oculto y respuesta a "qué es el One Piece".
- [x] Diseño visual: kit reutilizable, animaciones, móvil primero (2026-09-25).

## Seguridad
- [ ] Rotar la contraseña de Neon y el token de Render (se han pegado varias veces en el chat, otra vez el 2026-09-26).

## Próximos pasos (2026-09-25, la mayoría hecha el 26)
- [x] Desplegar: push del esquema a Neon (6 columnas en Character + tabla War) y resembrado; luego merge de `cloud/claude-nube` a `main`.
- [ ] Pasar la regresión completa con la clave de OpenRouter (en la nube faltaba, así que las comprobaciones que usan la IA no se pudieron ejecutar). El 2026-09-26 se lanzó `node scripts/run-all-checks.mjs --quick` completo tras el despliegue; revisar `shots/regression.log` cuando termine (tardó más de lo normal).
- [ ] Guerras: que los Shichibukai puedan ser llamados por el Gobierno a defender una base (hoy solo actúan marines y CP-0).
- [ ] El Coliseo como duelo en vivo, y Barbanegra con dos frutas como dato real (siguen pendientes).


## Hecho el 2026-09-26 (tarde)
- [x] Vida que no bajaba en combate (Barbosa vs Akio: 3 rondas con golpes narrados y 0 de daño para ambos): el árbitro devolvía `cambios` en 0 aunque la narración mostraba impactos. Ahora una herida narrada que cuesta 0 provoca un reintento correctivo y, si persiste, el código apunta un mínimo (roce 3 %, golpe sólido 8 % de la vida máxima). Vale para combate solo y en grupo (no en duelos entre jugadores). Vida de Barbosa corregida a mano en producción (106 → 93) y la de Akio (185 → 135).
- [x] Narrador en modo "narrar" escribía acciones que el jugador no escribió (caso Sebastian vs Akio: esquiva, bloqueo con la vaina y Haki inventados). Ahora hay regla "una jugada a la vez" en los prompts, un filtro (`playerActSentences`) con un reintento correctivo y recorte de frases, tanto en escena solo como en compartida. Respuesta de Sebastian rehecha en producción.
- [x] Regla Logia en todos los prompts (`LOGIA_RULE`): solo el Haki de Armadura hiere a un Logia.
- [x] Fruta original Tsuki Tsuki no Mi (Logia lunar, 1-de-1) en `game/devil-fruit-original.ts`; entregada a Zarpe (Marina, nivel 60, Vicealmirante, despertada) en producción.
