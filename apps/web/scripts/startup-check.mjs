export async function prepare(){
 if(!process.env.POSTGIS_URL)throw new Error('POSTGIS_URL is required in .env.local');
 await import('./prepare-map-worker.mjs');
}
