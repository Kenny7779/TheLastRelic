# 🗿 The Last Relic

> *Cuando el último artefacto se apague, el mundo lo hará con él.*

**The Last Relic** es un juego de aventura y exploración ambientado en un mundo en ruinas, donde los restos de una civilización antigua guardan el secreto para salvar lo que queda de la humanidad. Tú eres el último buscador de reliquias, y la reliquia final está esperando al fondo de la tierra olvidada.

> 🚧 **Estado del proyecto:** demo técnica jugable en el navegador (mapa, movimiento, romper/colocar bloques e inventario). Este documento describe la visión del juego y servirá de guía durante el desarrollo.
>
> ▶️ **Jugar la demo:** https://kenny7779.github.io/TheLastRelic/ *(se publica con GitHub Pages)*

---

## 📖 Historia

Hace siglos, una civilización dominó la energía de las **Reliquias**: artefactos capaces de sostener ciudades enteras, curar la tierra y alterar el clima. Un día, todas se apagaron salvo una.

Ahora el mundo se desmorona. Los pueblos se hunden en la oscuridad, los antiguos templos están sellados y quienes aún recuerdan el pasado se reparten entre los que quieren salvar la última Reliquia y los que quieren poseerla.

Tú recorrerás ruinas, templos y ciudades hundidas para llegar hasta ella. Pero cada paso exige una decisión: ¿usarás su poder para reiniciar el mundo, o dejarás que se extinga para siempre?

## 🎮 Concepto de juego

- **Género:** aventura y exploración con combate y puzles.
- **Perspectiva:** 2D vista desde arriba (top-down), estilo RimWorld.
- **Plataforma objetivo:** navegador web.
- **Modo:** un jugador.
- **Tono:** misterioso, melancólico y esperanzador.

### Pilares de diseño

1. **Explorar es recompensa.** Cada rincón del mapa esconde historia, secretos o mejoras.
2. **Cada reliquia cambia las reglas.** Los artefactos no son solo objetos: modifican cómo te mueves, luchas y resuelves puzles.
3. **Decisiones con peso.** Lo que hagas con la última Reliquia define el final.
4. **Un mundo que cuenta su historia sin explicarla.** La narrativa se descubre en el entorno, no en largas escenas.

## ⚙️ Mecánicas principales (propuesta)

| Mecánica | Descripción |
|---|---|
| **Exploración** | Mundo interconectado con zonas que se abren al conseguir nuevas reliquias. |
| **Reliquias** | Artefactos con poderes únicos (por ejemplo, manipular la luz, el tiempo o la gravedad) que sirven para avanzar y para combatir. |
| **Puzles ambientales** | Salas y mecanismos antiguos que se resuelven combinando las habilidades de las reliquias. |
| **Combate** | Enfrentamientos contra guardianes y criaturas de las ruinas, centrados en el uso inteligente de los poderes. |
| **Progresión** | Mejoras del personaje y de las reliquias a lo largo de la aventura. |
| **Finales múltiples** | Las decisiones sobre la última Reliquia llevan a distintos desenlaces. |

## 🌍 Mundo y ambientación

Las zonas son una idea inicial y pueden cambiar durante el desarrollo:

- **Las Tierras Grises:** páramos donde empieza el viaje, rodeados de restos de caravanas y ciudades abandonadas.
- **Los Templos Sellados:** complejos antiguos llenos de mecanismos y puzles.
- **La Ciudad Hundida:** metrópolis sumergida que conserva las memorias de la civilización perdida.
- **El Corazón de la Reliquia:** destino final, donde descansa el último artefacto.

## 🛠️ Tecnología

- Motor de juego: [Phaser 3](https://phaser.io/)
- Lenguaje: TypeScript
- Herramienta de build: Vite
- Generación del mundo: [simplex-noise](https://github.com/jwagner/simplex-noise.js)
- Arte y audio: por ahora los tiles y el personaje se dibujan por código; arte definitivo por definir

## 🗺️ Hoja de ruta

- [x] Crear el repositorio
- [x] Definir la visión inicial del juego
- [x] Elegir motor y tecnología (Phaser + TypeScript + Vite)
- [x] Demo: mundo de tiles, movimiento, cámara, romper/colocar bloques, inventario de 20 slots y la primera gema (Fuego)
- [ ] Hambre y salud
- [ ] Crafteo y herramientas
- [ ] Guardián de la gema de Fuego
- [ ] Biomas e identidad de las gemas de Hielo, Bosque y la cuarta
- [ ] Primera reliquia y primer puzle jugable
- [ ] Primera zona completa
- [ ] Sistema de combate
- [ ] Historia y finales
- [ ] Pulido, audio y primera versión jugable

## 🚀 Cómo ejecutarlo

Requiere [Node.js](https://nodejs.org/) 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo en http://localhost:5173
npm run build      # build de producción en dist/
npm run typecheck  # comprobación de tipos
```

### Controles de la demo

| Acción | Control |
|---|---|
| Moverse | `W A S D` o flechas |
| Romper bloque | Mantener click izquierdo (alcance limitado) |
| Colocar bloque | Click derecho (la madera sobre el agua crea un puente) |
| Elegir slot | `1`–`0` o rueda del ratón |
| Abrir inventario (20 slots) | `E` |

**Objetivo de la demo:** encuentra la ruina de piedra cerrada, rompe un muro para entrar y rompe la Gema de Fuego. Puedes cambiar el mundo con `?seed=123` en la URL.

### Publicación

El repositorio incluye un workflow de GitHub Actions (`.github/workflows/deploy.yml`) que compila y publica en GitHub Pages en cada push a `main`. Para activarlo una sola vez: **Settings → Pages → Source: GitHub Actions**.

## 🤝 Contribuir

El proyecto está en una etapa temprana. Si quieres proponer ideas o ayudar, abre un *issue* con tu sugerencia.

## 📄 Licencia

Por definir.
