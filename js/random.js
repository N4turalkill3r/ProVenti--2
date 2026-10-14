// Fuente de azar única de la simulación. Las pruebas la sustituyen por una secuencia fija.
let fuente = Math.random;
export const aleatorio = () => fuente();
export function usarAleatorio(fn) { fuente = typeof fn === 'function' ? fn : Math.random; }
