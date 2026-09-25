# Pendientes y mejoras (lista viva — actualizar en cada sesión)

Última actualización: 2026-09-25. Marca con [x] lo hecho.

## Decisiones del dueño (reglas fijas)
- [x] Nada de dados en ninguna parte: juez/árbitro IA decide; el código solo limita y aplica.
- [x] Solo IA de pago en OpenRouter (DeepSeek primero, gpt-4o-mini de respaldo). Nunca modelos gratis.
- [x] La vida de los NPC/rivales NO se muestra ni se escribe en cifras: la decide y cuenta el árbitro. Solo se ve la vida y la fatiga de los usuarios.
- [x] Tiempos de respuesta generosos: 24 h (rondas del Coliseo esperan a quien pelea, duelos/peleas conjuntas abandonadas, respuesta a una caza).
- [x] Barbanegra tiene DOS frutas (Yami Yami + Gura Gura) en su ficha.
- [x] El árbitro recuerda todo el combate (registro completo de rondas) para no olvidar heridas ni trucos.

## Verificación pendiente
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
- [ ] Conquista de territorios de un Yonko y reparto entre varios jugadores.
- [ ] Raid final contra el gobernante oculto y respuesta a "qué es el One Piece".
- [ ] Diseño visual pendiente (el dueño lo pedirá después).

## Seguridad
- [ ] Rotar la contraseña de Neon y el token de Render (se pegaron varias veces en el chat).
