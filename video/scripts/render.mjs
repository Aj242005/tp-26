import {bundle} from '@remotion/bundler';
import {getCompositions, openBrowser, renderMedia, renderStill} from '@remotion/renderer';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
mkdirSync('build', {recursive:true});
const browserExecutable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
console.log('Bundling film');
const serveUrl=await bundle({entryPoint:path.join(root,'src/index.ts'),publicDir:path.join(root,'public'),outDir:path.join(root,'build/bundle')});
console.log('Opening renderer');
const browser=await openBrowser('chrome',{browserExecutable,chromiumOptions:{disableWebSecurity:false}});
try {
  console.log('Loading composition');
  const composition=(await getCompositions(serveUrl,{puppeteerInstance:browser,timeoutInMilliseconds:120000,onBrowserLog:log=>console.log('Browser:',log.text)})).find(c=>c.id==='Prooflane');
  if (!composition) throw new Error('Composition is missing');
  if(process.argv.includes('--stills')) {
    const times=[7,14,24,37,46,54,68,77,85,99,111,118];
    for(let i=0;i<times.length;i++) {
      await renderStill({composition,serveUrl,puppeteerInstance:browser,output:path.join(root,`build/scene-${String(i).padStart(2,'0')}.png`),frame:times[i]*30,imageFormat:'png',timeoutInMilliseconds:120000,onBrowserLog:log=>console.log('Browser:',log.text)});
      console.log(`Reviewed-frame render ${i+1}/12`);
    }
  } else {
    const outputLocation=path.resolve(root,'../docs/deliverables/prooflane-timing-preview.mp4');
    let last=-1;
    await renderMedia({composition,serveUrl,puppeteerInstance:browser,codec:'h264',outputLocation,crf:18,x264Preset:'fast',audioBitrate:'320k',pixelFormat:'yuv420p',concurrency:2,imageFormat:'jpeg',jpegQuality:92,timeoutInMilliseconds:120000,onProgress:({progress})=>{const pc=Math.floor(progress*100);if(pc>=last+5){last=pc;console.log(`Render ${pc}%`);}}});
    writeFileSync('build/render-result.json',JSON.stringify({output:outputLocation,width:1920,height:1080,fps:30,frames:3600,duration:120,codec:'h264',narration:'en-IN-NeerjaNeural'},null,2));
    console.log(outputLocation);
  }
} finally {await browser.close({silent:true});}
