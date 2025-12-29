// Dynamic Puter.js loader to avoid React initialization conflicts

let puterLoaded = false;
let puterPromise: Promise<void> | null = null;

export async function loadPuter(): Promise<typeof puter> {
  if (puterLoaded && typeof puter !== 'undefined') {
    return puter;
  }
  
  if (!puterPromise) {
    puterPromise = new Promise((resolve, reject) => {
      // Check if already loaded
      if (typeof puter !== 'undefined') {
        puterLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.puter.com/v2/';
      script.onload = () => {
        puterLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Puter.js'));
      document.body.appendChild(script);
    });
  }
  
  await puterPromise;
  return puter;
}
