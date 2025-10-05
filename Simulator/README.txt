
# Terra (clone do projeto Yuri)

- Abra `index.html` no navegador (permita acesso a WebGL).
- Teclas do protótipo original continuam válidas (zoom/água/rotação etc.).
- **Hooks para edição**: `window.TERRA` expõe `add`, `remove`, e `makeSphere()`.
- Shaders e lógica principais continuam no `index.html` e em `js/xg.min.eb2.js`.

## Onde editar
- Escreva seus componentes em novos arquivos JS e inclua-os depois de `Config.js`.
- Para adicionar um objeto 3D:
  ```js
  const s = TERRA.makeSphere(3, 0xff00ff);
  TERRA.add(s);
  ```

## Pastas
- `js/` contém as libs (`xg.min.eb2.js`, `stats.min.js`, `Config.js`).
- `assets/` contém as texturas originais (Blue Marble & água).

