// Use only the locally installed VoiceStudio app's discovered preload API.
const pages=await (await fetch('http://127.0.0.1:9393/json/list')).json();
const page=pages.find(p=>p.type==='page' && p.url.startsWith('app://voicestudio'));
if(!page) {console.log(JSON.stringify(pages.map(p=>({type:p.type,title:p.title,url:p.url}))));process.exit(1);}
const expression=process.argv[2] || 'window.voicestudio.backend.getStatus()';
const socket=new WebSocket(page.webSocketDebuggerUrl);
const timer=setTimeout(()=>{console.error('Local app request timed out');socket.close();process.exitCode=1;},30000);
socket.addEventListener('open',()=>socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}})));
socket.addEventListener('message',({data})=>{const result=JSON.parse(data);if(result.id!==1)return;clearTimeout(timer);if(result.error||result.result?.exceptionDetails){console.error(JSON.stringify(result));process.exitCode=1;}else{console.log(JSON.stringify(result.result?.result?.value));}socket.close();});
