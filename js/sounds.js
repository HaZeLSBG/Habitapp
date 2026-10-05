// Reproduce los archivos de sonido reales de la carpeta /sounds
function play(path, volume = 0.5) {
  const audio = new Audio(path);
  audio.volume = volume;
  // El navegador puede bloquear el sonido si el usuario no ha interactuado
  // todavía con la página — lo ignoramos en silencio si eso pasa.
  audio.play().catch(() => {});
}

export function playComplete() {
  play("sounds/complete.mp3", 0.5);
}

export function playLevelUp() {
  play("sounds/levelup.mp3", 0.5);
}

export function playClick() {
  play("sounds/click.mp3", 0.35);
}
