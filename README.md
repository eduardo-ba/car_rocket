# Car Rocket

Juego 3D tipo Rocket League para el proyecto de inglés. Manejas un carro RC, lo transformas con **10 botones** y metes goles contra el carro naranja, pero hay **5 reglas** y cada regla rota tiene castigo. Todo el juego está en inglés.

## Cómo abrir el juego

| Forma | Cómo |
|---|---|
| **En tu compu** | Doble clic en **`JUGAR.bat`**. Se abre el navegador con el juego. Deja abierta la ventana negra mientras juegas y ciérrala para terminar. |
| **En línea** | https://claude.ai/artifact/5UBzQKSLL24iiyLyTPrbMW |

- La primera vez necesita internet (descarga el motor 3D y las fuentes).
- Abrir `index.html` con doble clic **no funciona**: los navegadores no cargan módulos de JavaScript desde archivos locales. Por eso existe `JUGAR.bat`.
- Si `JUGAR.bat` no abre (algunas escuelas bloquean PowerShell), usa el link en línea, o abre la carpeta en VS Code con la extensión *Live Server*, o en una terminal escribe `python -m http.server 8123` y entra a http://localhost:8123.

## Las voces (narrador)

El juego **lee en voz alta, en inglés, las instrucciones** de las notas: la bienvenida, la frase de cada uno de los **10 botones** y las **5 reglas** (16 frases en total).

- **Durante el partido**: la primera vez que usas un botón se lee su frase; cuando rompes una regla se lee la regla; en cada saque se lee una regla al azar. Abajo aparece el **subtítulo** con la frase y quién habla.
- **Botones de bocina** (🔊) en la guía *How to play*, en el menú (bienvenida) y en la pantalla final: escuchas cualquier frase cuando quieras. **Listen to all** las lee todas seguidas.
- **Las voces son del equipo**: `assets/voices/` trae las 16 frases (intro, 10 botones, 5 reglas) cortadas de la narración final, y el texto del juego dice exactamente lo mismo que los audios. Si falta un archivo, esa frase la lee la voz de la computadora.
- **Efectos de sonido**: `assets/sfx/` trae los 10 efectos de los botones.
- **Ajustes → Voice**: narrador *All / Rules / Off*, la voz de la computadora (con botón *Test*), velocidad, volumen y subtítulos. La música baja sola mientras alguien habla.
- La voz de la computadora (solo para los consejos del tutorial y el tour) depende del navegador: **Chrome y Edge** tienen buenas voces en inglés.

## Mecánicas de Rocket League

Basadas en los valores reales del juego (wiki de RLBot: *jumping physics* y *useful game values*), escaladas a esta cancha. Están en la pestaña **Moves** de *How to play*; los números se ajustan en `MOVES` de `js/config.js`.

| Mecánica | Cómo | Qué hace |
|---|---|---|
| Salto variable | Tocar o mantener Espacio | Un toque da 62 % del salto; mantener 0.2 s da el salto completo (como en RL) |
| Doble salto | Espacio otra vez, sin dirección | Sube más. Hay ~1.3 s después del primer salto |
| Front flip | W + Espacio en el aire | Gira hacia adelante y acelera |
| **Backflip** | S + Espacio en el aire | Gira hacia atrás (empuja un poco más que el frontal, como en RL) |
| Side / diagonal flip | A o D (+ W/S) + Espacio | Gira de lado o en diagonal |
| Half flip | En reversa: backflip y luego W | Cancela el backflip, el carro da media vuelta y sigue con su velocidad |
| Control aéreo | W/S y A/D en el aire | Inclina la nariz y gira el carro |
| Air roll | Q / E en el aire | Rota el carro sobre sí mismo |
| Aerial | Saltar + S + TURBO | En el aire el turbo empuja hacia donde apunta la nariz: se puede volar |
| Powerslide | Q / E en el suelo | Derrapa y gira 1.6 veces más rápido |
| Dodge hit | Flip contra el balón | Golpe 45 % más fuerte |
| Pads de boost | Pasar encima | 6 grandes (llenan la barra, vuelven en 10 s) y 14 chicos (+12, vuelven en 4 s). Con la barra llena no se toman |
| Supersonic | Velocidad máxima | Estela blanca y letrero SUPERSONIC |

- Cada truco muestra su nombre en pantalla (BACKFLIP, HALF FLIP, AERIAL, DODGE HIT…).
- El carro naranja también hace flips frontales contra el balón (Normal y Hard).
- **Las 5 reglas no cambiaron.** Un salto + flip son 2 presiones, así que no rompen la regla 4; pero 4 presiones en 1.5 s (por ejemplo salto + flip + salto + flip muy rápido) siguen explotando el carro. El aviso "!" en JUMP sale justo antes de la cuarta.

## Distribución de los botones

Las **4 acciones** están alrededor de W A S D, así nunca sueltas la dirección: **Espacio** = JUMP (pulgar), **Shift** = TURBO (meñique), **F** = GOAL y **R** = RADIO (índice). Las **6 transformaciones** van en **1 a 6** en el orden que piden las reglas: 1 SUBMARINE, 2 TRANSFORMER, 3 PLANE, **4 TUNING y 5 4X4 juntos** (la regla 5 se vuelve "primero el 4, luego el 5") y 6 MAD MAX al final (regla 1: necesita el TURBO de Shift). En el control de la pantalla cada grupo sigue ese mismo orden. Se cambia en `js/data/buttons.js` (`keys` y `slot`).

## Tutorial

En el menú, **PLAY** abre primero el tutorial: un partido de práctica sin reloj y sin el carro naranja, con **15 lecciones**. Al final, **Play a match** empieza el partido de 3 minutos; **Skip tutorial** (arriba de la tarjeta) salta directo al partido.

1. Bienvenida · 2. Manejar (toca el balón) · 3. JUMP · 4. Regla 4 (salta 3 veces despacio) · 5. TURBO · 6. GOAL (tiro potente) · 7. Regla 2 (anota y no saltes hasta el saque) · 8. RADIO · 9. Regla 3 (apágalo con un solo clic) · 10. SUBMARINE (y regresar) · 11. TRANSFORMER · 12. PLANE · 13. Regla 5 (TUNING y luego 4X4) · 14. Regla 1 (TURBO y luego MAD MAX) · 15. ¡Listo! → jugar un partido.

- Cada tarjeta muestra la frase de las notas, la instrucción, las teclas y una lista de tareas que **se palomean solas** cuando el juego detecta que lo hiciste; luego pasa sola a la siguiente.
- El botón que tienes que presionar **brilla en dorado** en el control de la pantalla.
- El **narrador** lee primero la frase del botón o de la regla (con la voz del equipo) y luego la instrucción. La bocina 🔊 de la tarjeta la repite.
- Si rompes una regla a propósito, el tutorial te explica el castigo: en las reglas 2, 3 y 4 cuenta como aprendida; en las reglas 1 y 5 te dice cómo hacerlo bien.
- **Enter** o **Next** avanza, **Back** regresa, **Skip tutorial** va directo al partido. La lógica está en `js/ui/tutorial.js`.

## Tu canción de fondo

- En el menú: **Background Music → CHOOSE SONG** y eliges un MP3. Se guarda en ese navegador.
- `assets/music/cancion.mp3` ya trae la música del equipo (una vuelta de 2:07 que se repite sin cortes) y se carga sola al abrir con `JUGAR.bat`.
- **RADIO** sube el volumen; doble clic en RADIO (regla 3) corta la música 10 segundos; con el **SUBMARINE** se oye como bajo el agua.

## Controles

| Tecla | Acción |
|---|---|
| W A S D / flechas | Manejar |
| Espacio | Saltar (tocar = salto corto, mantener = salto alto) |
| Dirección + Espacio en el aire | Flip: W frontal, S backflip, A/D lateral, sin dirección = doble salto |
| Q / E (mantener) | Powerslide en el suelo, air roll en el aire |
| Shift | TURBO ON / OFF |
| F | GOAL (tiro potente) |
| R | RADIO |
| 1 · 2 · 3 | SUBMARINE · TRANSFORMER · PLANE |
| 4 → 5 | TUNING → 4X4 (regla 5: primero el 4, luego el 5) |
| 6 | MAD MAX (regla 1: con TURBO encendido) |
| C | Cámara al balón |
| H / P / Esc | Reglas y pausa |
| M | Sonido (también calla al narrador) |
| → / ← / Esc | Tour del HUD: siguiente, atrás, saltar |

## Estructura del proyecto

```
JUEGO_INGLES/
├── index.html            Estructura de la página (HUD, menús)
├── JUGAR.bat             Abre el juego en el navegador
├── css/
│   ├── tokens.css        Sistema de diseño: colores, fuentes, tamaños, capas
│   ├── base.css          Estilos generales
│   ├── components.css    Botones, pestañas, tooltip, interruptores, slider
│   ├── hud.css           Marcador, control remoto, mensajes
│   └── screens.css       Menú, pausa y pantalla final
├── js/
│   ├── boot.js           Arranque (muestra un error claro si algo falla)
│   ├── main.js           Une todo y corre el bucle del juego
│   ├── config.js         Medidas, física, dificultad y modos del carro
│   ├── data/             Los 10 botones, las 5 reglas y voice-lines.js (las 16 frases del narrador)
│   ├── core/             Three.js r170 (desde jsDelivr, versión fija en three.js), utilidades, eventos y guardado
│   ├── engine/           Render, cámara, materiales y combinación de geometría
│   ├── world/            Estadio (tazón de gradas, público, techo, torres), cielo y ciudad (sky.js),
│   │                     texturas dibujadas por código (textures.js), pantallas LED, balón, agua y pads
│   ├── entities/         El carro: modelo 3D y física de manejo
│   ├── game/             Estado, reglas/botones, física, bot y partido
│   ├── audio/            Efectos, ritmo, tu canción, samples.js (efectos de los botones) y voice.js (el narrador)
│   ├── fx/               Partículas y marcas de llanta
│   ├── ui/               Interfaz:
│   │   ├── hud.js          barra superior, luces de reglas, turbo, castigos
│   │   ├── remote.js       los 10 botones con sus estados y tooltips
│   │   ├── tooltip.js      tooltips (mouse y teclado)
│   │   ├── notify.js       mensajes, banner y tarjeta de regla rota
│   │   ├── screens.js      menú, pausa, pantalla final
│   │   ├── dialog.js       ventanas modales y confirmación
│   │   ├── tabs.js         pestañas accesibles
│   │   ├── guide.js        guía "How to play"
│   │   ├── settings.js     ajustes en pestañas: Game, Music, Voice
│   │   ├── listen.js       botones de bocina y "Listen to all"
│   │   ├── caption.js      subtítulos del narrador
│   │   ├── tour.js         tour guiado del HUD
│   │   ├── tutorial.js     tutorial interactivo: 15 lecciones de los botones y las reglas
│   │   └── dom.js, icons.js
│   └── input/            Teclado y controles táctiles
├── assets/music/         cancion.mp3: la música de fondo
├── assets/voices/        Las grabaciones del equipo (intro.mp3, jump.mp3, rule1.mp3...)
├── assets/sfx/           Los efectos de sonido de los 10 botones (jump.mp3, turbo.mp3...)
└── tools/servidor.ps1    Servidor local que usa JUGAR.bat
```

## Dónde cambiar cosas

- Velocidad de los carros, tamaño de la cancha, dificultad, tiempo del partido: `js/config.js`
- Fuerza de los flips, salto, aerial y powerslide: `MOVES` en `js/config.js`; la física está en `js/entities/car.js`
- Textos de los botones y de las reglas: `js/data/buttons.js` y `js/data/rules.js` (el narrador lee lo mismo)
- Cuándo habla el narrador y cada cuánto repite un botón: `js/audio/voice.js`
- Qué hace cada botón y cómo se revisan las reglas: `js/game/actions.js`
- Qué muestra cada botón (encendido, recargando, aviso de regla): `js/game/remote-state.js`
- Límites de las reglas (doble clic, saltos seguidos, segundos de castigo): `RULE` en `js/config.js`
- Colores, tamaños y fuentes de la interfaz: `css/tokens.css`
- El estadio (gradas, paredes, porterías, techo, torres): `js/world/stadium.js`; el pasto, la red, el vidrio y las ventanas: `js/world/textures.js`; el cielo y la ciudad: `js/world/sky.js`

## Interfaz (UI/UX)

- **Tooltips** en todo: los 10 botones (teclas, la frase de las notas, qué hacen, su regla y su estado en vivo), los grupos Actions/Transform, el marcador, las luces de reglas, el turbo, el modo, la música, el castigo, el subtítulo, los botones de opciones y el reporte final. Aparecen con el mouse o con el teclado (Tab) y se cierran con Esc.
- **Botones "i"** junto a cada ajuste que explican cómo funciona (también con un toque en celular).
- **Tour del HUD**: la primera partida se pausa y una guía ilumina cada parte de la pantalla y la explica (el narrador la lee). Se repite desde la pausa con **HUD tour**.
- **Ajustes en pestañas** (Game / Music / Voice), así el menú cabe mejor.
- **Botones con estados**: encendido, recargando (con segundos), roto, listo (GOAL brilla cuando el balón está cerca) y **aviso "!"** cuando presionarlo rompería una regla.
- **Luces de las 5 reglas** arriba: se ponen rojas cuando rompes una, con contador.
- **Aviso de castigo** con cuenta atrás (motor apagado, radio rota, carro explotado).
- **Menú sin scroll**: PLAY siempre visible; la guía está en pestañas (Controls / 10 Buttons / 5 Rules).
- **Pausa** con ayuda y ajustes; reiniciar o salir pide confirmación.
- **Pantalla final** con reporte: qué reglas seguiste y cuáles rompiste.
- **Accesible**: navegable con teclado, foco dentro de las ventanas, roles ARIA, botones de 44 px, respeta "reducir movimiento".

## Rendimiento

- Partículas y marcas de llanta con *instancing*: cientos de objetos en 1 llamada de dibujo por tipo.
- El estadio, los pads y los carros combinan sus piezas fijas por material, así que el navegador dibuja muchas menos piezas.
- **Movimiento suave en cualquier monitor** (60, 75, 144 Hz…): los carros y el balón se dibujan *interpolados* entre los dos últimos pasos de física, así no dan saltitos aunque la física vaya a 120 pasos por segundo.
- **Resolución dinámica**: si el juego pierde cuadros de forma constante (no por un tirón suelto), dibuja 10 % menos píxeles por lado, hasta 70 %; si en HIGH sigue lento, sugiere **LOW**. Nunca dibuja a más de 1.25× la pantalla.
- **Sin congelones la primera vez**: al cargar se compilan todos los shaders (los 7 modos del carro, explosiones, agua, HIGH y LOW).
- Gradas, cancha y piso usan material *Lambert* (más barato); el vidrio no se ilumina; el cielo se dibuja al final, solo donde se ve; el bloom trabaja a ¼ de resolución y el antialiasing es FXAA (1 pasada).
- **LOW** quita además sombras, bloom, haces de luz y destellos.
- La física corre a paso fijo (120 por segundo), así que se juega igual en cualquier computadora.
- El HUD solo cambia el texto cuando cambia el valor.

## Gráficos e iluminación (Three.js r170)

- **Color real**: el render trabaja en espacio lineal y muestra en sRGB, con *tone mapping* neutral (respeta los colores de los carros y la cancha).
- **Luces**: una luz principal desde una torre (proyecta las sombras), una luz de relleno desde la torre opuesta, luz de cielo suave, una luz naranja y una azul en cada portería, y **reflejos** de un mini-estadio (pintura, vidrio y metal reflejan las lámparas).
- **Brillo HDR (bloom)**: solo brilla lo que emite luz (lámparas, neón, pads, pantallas, faros), no la cancha iluminada. Los neones de colores se calibran por luminancia (`neon()` en `js/engine/kit.js`) para que el azul brille igual que el naranja.
- **Haces de luz** de las torres con un shader que se desvanece en las orillas, y destellos en las lámparas.
- Bordes suaves con **FXAA**. Todo lo anterior solo en **GRAPHICS: HIGH**; LOW dibuja directo sin bloom ni sombras.
- Dónde ajustar: intensidades y bloom en `js/engine/renderer.js`; focos de las torres y luces de portería en `js/world/stadium.js`.
- El público (miles de personas y asientos) son 3 mallas con *instancing*; el cielo con estrellas, luna y nubes es un solo shader, y la ciudad de fondo es una sola malla. Todas las texturas se dibujan con código: no hay imágenes que descargar.
