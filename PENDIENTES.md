# Pendientes y mejoras (lista viva — actualizar en cada sesión)

Última actualización: 2026-09-25 (noche). Marca con [x] lo hecho.

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
- [ ] Poneglifos: el poseedor real pelea según dónde esté (hoy siempre un subordinado).
- [x] Conquista de territorios de un Yonko y reparto entre varios jugadores.
- [x] Ruta de Yonko por mérito, desafío en persona a un Yonko canon (veredicto del dueño para su muerte o captura), Shichibukai para piratas, guerras contra la Marina y entre Yonko, reacción del mundo y figuras mundiales en las noticias (2026-09-25).
- [x] CP-0 empieza en Tequila Wolf (isla de nivel 1). 7 islas y 33 personajes canon nuevos.
- [ ] Raid final contra el gobernante oculto y respuesta a "qué es el One Piece".
- [x] Diseño visual: kit reutilizable, animaciones, móvil primero (2026-09-25).

## Seguridad
- [ ] Rotar la contraseña de Neon y el token de Render (se pegaron varias veces en el chat).

## Próximos pasos (2026-09-25)
- [ ] Desplegar: push del esquema a Neon (6 columnas en Character + tabla War) y resembrado; luego merge de `cloud/claude-nube` a `main`.
- [ ] Pasar la regresión completa con la clave de OpenRouter (en la nube faltaba, así que las comprobaciones que usan la IA no se pudieron ejecutar).
- [ ] Guerras: que los Shichibukai puedan ser llamados por el Gobierno a defender una base (hoy solo actúan marines y CP-0).
- [ ] El Coliseo como duelo en vivo, y Barbanegra con dos frutas como dato real (siguen pendientes).

