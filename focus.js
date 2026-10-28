// Preserve keyboard focus indicators without treating fullscreen as navigation.
document.addEventListener('pointerdown',()=>{document.documentElement.dataset.focusInput='pointer'},true);
document.addEventListener('keydown',event=>{
 if(['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(event.key))document.documentElement.dataset.focusInput='keyboard';
},true);
