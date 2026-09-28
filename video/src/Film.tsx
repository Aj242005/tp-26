/**
 * THESIS: Evidence becomes a decision through an inspectable chain. Demonstrate one real rule.
 * OWN-WORLD: Existing Prooflane graphite, blue routes, Geist, semantic verdict colours; enlarged source typography.
 * STORY: Vendor fragmentation → source-backed verdict → reviewed adaptation → durable architecture → qualified scope.
 * FIRST VIEWPORT: A large question on the left; three vendor configuration fragments merge on the right.
 * FORM: A precisely timed 120-second evidence journey, with a travelling blue proof line, native motion diagrams,
 * actual synthetic application footage, a 3D provenance capture, en-IN narration and synchronised English captions.
 * The video extends DESIGN.md. Illustrative diagrams are labelled; actual qualification figures keep their scope.
 */
import React, {type CSSProperties, type ReactNode} from 'react';
import {AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {ArrowRight, Check, CheckCheck, CircleHelp, FileCode2, FileText, GitBranch, LockKeyhole, Network, Search, Server, ShieldCheck, X} from 'lucide-react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import scenes from '../script.json';
import captions from './captions.json';
import './style.css';

const C = {bg:'#0d1017',panel:'#151b26',raised:'#202938',ink:'#ecf0f7',muted:'#a5b0c3',line:'#354159',blue:'#4466df',light:'#a3bcff',green:'#85d8b0',amber:'#efc479',red:'#ff9b9b'};
const clamp = (v:number) => Math.max(0,Math.min(1,v));
const ease = (v:number) => 1-Math.pow(1-clamp(v),4);
const progress = (f:number,delay=0,length=25) => ease((f-delay)/length);
const fade = (f:number,delay=0) => clamp((f-delay)/12);
const at = (left:number,top:number,other:CSSProperties={}):CSSProperties => ({position:'absolute',left,top,...other});
const move = (f:number,delay=0,dy=35):CSSProperties => ({opacity:fade(f,delay),transform:`translateY(${(1-progress(f,delay))*dy}px)`});

function Logo({size=40, colour=C.light}:{size?:number,colour?:string}) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none"><path d="M12 44V18L32 7l20 11v25L32 56 12 44Z" stroke={colour} strokeWidth="4"/><path d="M23 33l7 7 13-17" stroke={colour} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function Label({children,colour=C.muted,style={}}:{children:ReactNode,colour?:string,style?:CSSProperties}) {
  return <div style={{fontSize:26,color:colour,...style}}>{children}</div>;
}
function Title({children,sub,frame=0}:{children:ReactNode,sub?:string,frame?:number}) {
  return <div style={{...at(90,145),...move(frame,2)}}><h1>{children}</h1>{sub && <div style={{fontSize:29,color:C.muted,marginTop:20}}>{sub}</div>}</div>;
}
function Badge({children,colour=C.light}:{children:ReactNode,colour?:string}) {
  return <span style={{display:'inline-flex',gap:12,alignItems:'center',fontSize:25,fontWeight:550,color:colour,background:colour+'14',border:`1px solid ${colour}44`,padding:'10px 18px',borderRadius:8}}>{children}</span>;
}
function Route({d,frame,delay=0,colour=C.blue,width=5}:{d:string,frame:number,delay?:number,colour?:string,width?:number}) {
  const p=progress(frame,delay,40);
  return <svg style={{position:'absolute',inset:0,width:1920,height:1080,pointerEvents:'none'}}><path d={d} fill="none" stroke={C.line} strokeWidth={2}/><path d={d} fill="none" stroke={colour} strokeWidth={width} pathLength={1} strokeDasharray={1} strokeDashoffset={1-p} strokeLinecap="round"/></svg>;
}
function File({name,code,x,y,frame,delay,angle=0}:{name:string,code:string[],x:number,y:number,frame:number,delay:number,angle?:number}) {
  return <div className="file" style={{...at(x,y,{width:650}),...move(frame,delay),transform:`translateX(${(1-progress(frame,delay))*100}px) rotate(${angle}deg)`}}>
    <div className="file-head"><FileCode2 size={30} color={C.light}/><span>{name}</span></div>
    <div className="file-code">{code.map((line,i)=><div key={i} style={{display:'flex',gap:28}}><span style={{color:'#66748e'}}>{String(i+1).padStart(2,'0')}</span><span>{line}</span></div>)}</div>
  </div>;
}

function Problem() {
  const f=useCurrentFrame();
  return <AbsoluteFill>
    <div style={{...at(90,180),...move(f,4)}}><Label colour={C.light}>The audit challenge</Label><h1 style={{fontSize:100,lineHeight:1.08,marginTop:28}}>One network.<br/>Many languages.</h1></div>
    <div style={{...at(90,568),...move(f,115)}}><div style={{fontSize:51,lineHeight:1.23}}>Can you <span style={{color:C.light}}>prove</span><br/>why a setting is unsafe?</div><div style={{marginTop:34,fontSize:25,color:C.muted}}>For network teams and security auditors</div></div>
    <File name="Cisco IOS / IOS-XE" code={['ip ssh version 1','logging host 192.0.2.10']} x={1080} y={190} frame={f} delay={18} angle={-3}/>
    <File name="Junos · set format" code={['set system services ssh','    protocol-version v2']} x={1020} y={427} frame={f} delay={38} angle={1}/>
    <File name="FortiOS" code={['config system global','    set admin-ssh-v1 disable']} x={1090} y={664} frame={f} delay={58} angle={3}/>
    <div style={at(1105,925)}><Label style={{fontSize:22}}>Illustrative configuration fragments</Label></div>
  </AbsoluteFill>;
}

function PromiseScene() {
  const f=useCurrentFrame();
  return <AbsoluteFill>
    <div style={{...at(90,158,{display:'flex',gap:24,alignItems:'center'}),...move(f)}}><Logo size={78}/><span style={{fontSize:76,fontWeight:650,letterSpacing:'-.03em'}}>Prooflane</span></div>
    <div style={{...at(90,318),...move(f,12)}}><h1 style={{fontSize:86}}>Every finding.<br/><span style={{color:C.light}}>A trail of proof.</span></h1><div style={{fontSize:31,marginTop:28,lineHeight:1.5,color:C.muted}}>Checks router and firewall settings.<br/>Evidence you can inspect.</div></div>
    <div style={{...at(890,186,{width:1080,height:658,overflow:'hidden',borderRadius:14,boxShadow:'0 24px 60px #0006'}),...move(f,22),transform:`perspective(1900px) rotateY(${-8+progress(f,0,230)*5}deg) scale(${.95+progress(f,0,230)*.04})`}}><Img src={staticFile('overview.png')} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top left'}}/></div>
    <Route d="M100 835 H460 Q500 835 540 835 H730" frame={f} delay={45}/>
    {['Source','Rule','Finding'].map((t,i)=><div key={t} style={{...at(95+i*236,800,{background:C.bg,padding:'15px 20px'}),...move(f,50+i*20)}}><Label colour={i===2?C.green:C.light}>{t}</Label></div>)}
    <Label style={at(910,883,{fontSize:22})}>Actual application · synthetic records</Label>
  </AbsoluteFill>;
}

function Workflow() {
  const f=useCurrentFrame();
  const labels=[['Upload','Saved configuration'],['Declare scope','Vendor + firmware'],['Choose policy','Pinned rule version'],['Run audit','Deterministic checks']];
  const icons=[FileCode2,Network,ShieldCheck,CheckCheck];
  return <AbsoluteFill>
    <Title frame={f} sub="A repeatable workflow, from saved file to recorded finding.">Snapshot to assessment.</Title>
    <Route d="M280 520 H1600" frame={f} delay={24}/>
    {labels.map(([name,desc],i)=>{const Icon=icons[i];return <div key={name} style={{...at(90+i*455,355,{width:360}),...move(f,18+i*23)}}><div style={{height:260,background:i===3?C.blue:C.panel,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}><Icon size={92} strokeWidth={1.2} color={i===3?C.ink:C.light}/><div style={at(22,20,{fontSize:23,color:i===3?'#dce5ff':C.muted})}>0{i+1}</div></div><div style={{fontSize:38,fontWeight:550,marginTop:30}}>{name}</div><Label style={{marginTop:12}}>{desc}</Label></div>;})}
    <div style={{...at(90,830,{display:'flex',gap:38,alignItems:'center'}),...move(f,145)}}><Badge>Single or bulk upload</Badge><Label>Up to 100 files per batch</Label><span style={{color:C.line,fontSize:32}}>│</span><Label>Complete snapshot or clearly marked snippet</Label></div>
  </AbsoluteFill>;
}

function Evidence() {
  const f=useCurrentFrame();
  const lines=['! SYNTHETIC · review example','version 16.12','hostname example-branch-02','ip http server','ip ssh version 1','ip ssh time-out 120','ip ssh authentication-retries 8'];
  return <AbsoluteFill>
    <Title frame={f} sub="One finding. An exact source. A reviewable decision.">Show me the evidence.</Title>
    <div className="file" style={{...at(90,345,{width:870}),...move(f,14)}}><div className="file-head"><FileCode2 size={31} color={C.light}/>ios-review.cfg <span style={{marginLeft:'auto',fontSize:23,color:C.amber}}>Synthetic example</span></div><div className="file-code" style={{padding:'24px 0',fontSize:30}}>{lines.map((line,i)=><div key={line} style={{display:'flex',gap:29,padding:'13px 30px',position:'relative',background:i===4?`rgba(255,155,155,${.04+progress(f,60)*.12})`:undefined,color:i===4?C.red:i===0?C.muted:C.ink}}><span style={{color:i===4?C.red:'#66748e',minWidth:28}}>{i+1}</span><span>{line}</span>{i===4&&<div style={{position:'absolute',inset:0,border:`2px solid ${C.red}`,opacity:fade(f,60),borderRadius:3}}/>}</div>)}</div></div>
    <Route d="M960 708 H1005 Q1030 708 1030 670 V476 Q1030 450 1060 450 H1110" frame={f} delay={92} colour={C.red}/>
    <div style={{...at(1120,355,{width:700}),...move(f,104)}}><Badge colour={C.red}><X size={26}/>Fail · High severity</Badge><h2 style={{fontSize:45,margin:'25px 0 12px'}}>Require SSH version 2</h2><Label>AC-04 · Team technical baseline v1</Label>
      <div style={{display:'flex',gap:90,marginTop:38,padding:'28px 0',borderTop:`1px solid ${C.line}`,borderBottom:`1px solid ${C.line}`}}><div><Label>Observed</Label><div style={{fontSize:92,color:C.red,lineHeight:1.2}}>1</div></div><div><Label>Expected</Label><div style={{fontSize:92,color:C.green,lineHeight:1.2}}>2</div></div></div>
      <div style={{...move(f,215),marginTop:31}}><Label colour={C.light}>Proposed command</Label><div className="mono" style={{fontSize:35,marginTop:15}}>ip ssh version 2</div><div style={{display:'flex',alignItems:'center',gap:12,marginTop:21,fontSize:24,color:C.amber}}><LockKeyhole size={23}/>Human review before any device change</div></div>
    </div>
  </AbsoluteFill>;
}

function Unknown() {
  const f=useCurrentFrame();
  const verdicts=[{name:'Pass',meaning:'Evidence matches',colour:C.green,icon:Check},{name:'Fail',meaning:'Setting breaks the rule',colour:C.red,icon:X},{name:'Unknown',meaning:'Need more evidence',colour:C.amber,icon:CircleHelp}];
  return <AbsoluteFill><Title frame={f} sub="A missing fact never becomes an assumed pass.">Unknown is a useful answer.</Title>
    {verdicts.map((v,i)=>{const Icon=v.icon;return <div style={{...at(90+i*590,355,{width:560,padding:'38px 36px',borderTop:`2px solid ${v.colour}`,background:C.panel}),...move(f,14+i*18)}} key={v.name}><Icon size={62} strokeWidth={1.5} color={v.colour}/><div style={{fontSize:54,marginTop:24,color:v.colour,fontWeight:550}}>{v.name}</div><Label style={{fontSize:29,marginTop:17}}>{v.meaning}</Label></div>;})}
    <div style={{...at(90,733,{width:1740}),...move(f,95)}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}><div style={{fontSize:35}}>Evaluated coverage</div><Label colour={C.ink}>11 / 20 checks · <strong>55%</strong></Label></div><div style={{display:'flex',height:25,gap:7,marginTop:26}}>{Array.from({length:20},(_,i)=><div key={i} style={{flex:1,background:i<2?C.green:i<11?C.red:C.amber,opacity:i<Math.floor(progress(f,104,65)*20)?1:.1,borderRadius:2}}/>)}</div><Label style={{marginTop:22,fontSize:23}}>ios-review.cfg · 2 pass · 9 fail · 9 need evidence · synthetic fixture</Label></div>
  </AbsoluteFill>;
}

function Product() {
  const f=useCurrentFrame();
  return <AbsoluteFill><Title frame={f}>Inspect. Explain. Export.</Title>
    <div style={{...at(90,285,{width:1240,height:650,overflow:'hidden',borderRadius:14,background:C.panel}),...move(f,8)}}><OffthreadVideo src={staticFile('app-evidence.mp4')} muted style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'top',transform:`scale(${1+clamp(f/270)*.045})`,transformOrigin:'70% 35%'}}/><Img src={staticFile('evidence-detail.png')} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',opacity:progress(f,38,22),transform:`scale(${1+clamp((f-60)/210)*.035})`,transformOrigin:'70% 55%'}}/></div>
    <div style={at(1400,345,{width:430})}>{[['Inspect','Cited source lines'],['Explain','Observed vs expected'],['Export','PDF · JSON · CSV']].map(([title,desc],i)=><div key={title} style={{...move(f,20+i*60),paddingBottom:34,marginBottom:28,borderBottom:`1px solid ${C.line}`}}><div style={{display:'flex',gap:20,alignItems:'center',fontSize:39,color:i===2?C.green:C.ink}}><ArrowRight size={34} color={C.light}/>{title}</div><Label style={{margin:'17px 0 0 54px'}}>{desc}</Label></div>)}</div>
    <div style={at(113,905,{background:C.bg,padding:'6px 12px',fontSize:21,color:C.muted})}>Actual application · synthetic configuration</div>
  </AbsoluteFill>;
}

function Learning() {
  const f=useCurrentFrame();
  const steps=[['Investigate','Approved references'],['Clarify','Missing context'],['Propose','Rule for reading settings'],['Test','Match + non-match'],['Review','Human approval']];
  return <AbsoluteFill><Title frame={f} sub="The differentiator: tested, reviewed interpretation of unfamiliar formats.">Unfamiliar syntax?<br/><span style={{color:C.light}}>Build understanding.</span></Title>
    <div style={{...at(1190,160,{width:630,padding:'29px 34px',background:C.panel,borderRadius:12}),...move(f,12)}}><Label colour={C.amber}>Illustrative unfamiliar command</Label><div className="mono" style={{fontSize:31,marginTop:22}}>secure-shell-version 2</div><div style={{display:'flex',gap:17,alignItems:'center',marginTop:22}}><ArrowRight size={28} color={C.light}/><span className="mono" style={{fontSize:29,color:C.green}}>ssh_version = 2</span></div></div>
    <Route d="M245 570 H1665" frame={f} delay={40}/>
    {steps.map(([title,desc],i)=><div key={title} style={{...at(90+i*355,466,{width:315}),...move(f,35+i*39)}}><div style={{height:205,background:i===4?'#2c281e':C.panel,border:`1px solid ${i===4?C.amber:C.line}`,borderRadius:12,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:20}}><div style={{fontSize:24,color:i===4?C.amber:C.light}}>{i===4?'Approval gate':i<3?'Gemini + bounded tools':'Validation cases'}</div><div style={{fontSize:37,fontWeight:550}}>{title}</div></div><Label style={{textAlign:'center',fontSize:24,marginTop:23}}>{desc}</Label></div>)}
    <div style={{...at(90,824,{display:'flex',alignItems:'center',gap:24}),...move(f,243)}}><LockKeyhole size={38} color={C.amber}/><div style={{fontSize:32}}>AI output stays a draft until a reviewer activates it.</div></div>
    <Label style={{...at(90,891,{fontSize:23}),...move(f,290)}}>Exact vendor and firmware scope · Text / JSON / XML mappings · No model fine-tuning</Label>
  </AbsoluteFill>;
}

function Versions() {
  const f=useCurrentFrame();
  return <AbsoluteFill><Title frame={f} sub="A new interpretation never rewrites an earlier assessment.">New understanding.<br/><span style={{color:C.light}}>Preserved history.</span></Title>
    <div style={{...at(90,430,{width:725}),...move(f,15)}}><div style={{display:'flex',gap:18,alignItems:'center',fontSize:35}}><LockKeyhole size={38} color={C.light}/>Existing audit</div>{[['Input','Original content hash'],['Policy','Pinned rule version'],['Mapping','Captured approved version']].map(([key,value],i)=><div key={key} style={{display:'flex',padding:'25px 0',borderBottom:`1px solid ${C.line}`,fontSize:27,gap:40}}><span style={{color:C.muted,width:135}}>{key}</span><span>{value}</span></div>)}</div>
    <Route d="M875 610 H960 Q1000 610 1000 575 V505 Q1000 480 1030 480 H1130" frame={f} delay={57}/>
    <div style={{...at(1110,417,{width:710,padding:'34px 38px',background:C.panel,borderRadius:14}),...move(f,73)}}><div style={{fontSize:35,display:'flex',gap:17,alignItems:'center'}}><GitBranch size={37} color={C.green}/>Future audit</div><div style={{fontSize:29,color:C.green,marginTop:28}}>Uses the newly approved mapping</div><Label style={{marginTop:17}}>Available without a code deployment</Label><div style={{marginTop:32,paddingTop:24,borderTop:`1px solid ${C.line}`,color:C.amber,fontSize:27,...move(f,141)}}>Retire a mapping to stop future use.</div></div>
    <div style={{...at(90,842),...move(f,174)}}><Badge colour={C.green}><Check size={25}/>Versioned. Reviewable. Repeatable.</Badge></div>
  </AbsoluteFill>;
}

function Trail() {
  const f=useCurrentFrame();
  return <AbsoluteFill><Title frame={f}>Follow the audit in 3D.</Title>
    <div style={{...at(80,280,{width:1260,height:660,overflow:'hidden',borderRadius:12}),...move(f,6)}}><Img src={staticFile('trail.png')} style={{height:'100%',width:'100%',objectFit:'cover',objectPosition:'center',transform:`scale(${1+clamp(f/240)*.035})`}}/></div>
    <div style={{...at(1400,350,{width:420}),...move(f,35)}}><Label colour={C.light}>Recorded audit trail</Label><div style={{fontSize:50,lineHeight:1.2,marginTop:22}}>Select a stage.<br/>Inspect its<br/>evidence.</div><div style={{fontSize:26,color:C.muted,lineHeight:1.55,marginTop:38}}>Source hashes.<br/>Pinned rules.<br/>Facts and verdicts.<br/>Recorded tool results.</div></div>
    <div style={{...at(1400,842,{fontSize:24,color:C.amber}),...move(f,100)}}>Shows recorded audit history.</div>
    <div style={at(105,906,{fontSize:21,color:C.muted,background:C.bg,padding:'6px 10px'})}>Actual 3D trail · synthetic assessment</div>
  </AbsoluteFill>;
}

function Architecture() {
  const f=useCurrentFrame();
  const nodes=[{x:130,y:354,w:385,title:'React',sub:'Evidence workspace',icon:Network},{x:655,y:354,w:420,title:'FastAPI',sub:'Authorised requests',icon:ShieldCheck},{x:1235,y:354,w:535,title:'Durable workers',sub:'Deterministic evaluation',icon:Server}];
  return <AbsoluteFill><Title frame={f} sub="Local Docker services · optional hosted Gemini inference">Built for accountable processing.</Title>
    <div style={at(88,315,{width:1745,height:480,border:`1px solid ${C.line}`,borderRadius:15})}/>
    <Route d="M515 444 H1235" frame={f} delay={25}/><Route d="M868 535 V630 M1500 535 V595 H860 Q600 595 440 595 V630 M1500 595 V630" frame={f} delay={89}/>
    {nodes.map((n,i)=><div key={n.title} style={{...at(n.x,n.y,{width:n.w,height:182,padding:'27px 30px',background:i===2?C.blue:C.panel,borderRadius:12}),...move(f,12+i*22)}}><div style={{display:'flex',gap:16,alignItems:'center',fontSize:37,fontWeight:550}}><n.icon size={37} color={i===2?C.ink:C.light}/>{n.title}</div><div style={{fontSize:25,color:i===2?'#e0e7ff':C.muted,marginTop:23}}>{n.sub}</div></div>)}
    {[{x:130,w:420,title:'Keycloak + Valkey',sub:'Identity · roles · shared limits'},{x:645,w:435,title:'PostgreSQL',sub:'Records · durable jobs · isolation'},{x:1205,w:565,title:'Encrypted object storage',sub:'Snapshots and report artifacts'}].map((n,i)=><div key={n.title} style={{...at(n.x,635,{width:n.w,padding:'26px 26px',background:C.panel,borderRadius:10}),...move(f,88+i*18)}}><div style={{fontSize:31,color:C.light}}>{n.title}</div><Label style={{fontSize:23,marginTop:17}}>{n.sub}</Label></div>)}
    <div style={{...at(130,811,{display:'flex',gap:24,alignItems:'center'}),...move(f,193)}}><Badge colour={C.amber}>Gemini · hosted investigation</Badge><Label>Optional · redacted context + approved references</Label></div>
    <div style={{...at(90,918,{fontSize:29,color:C.green}),...move(f,292)}}><Check size={27} style={{verticalAlign:'middle',marginRight:13}}/>Deterministic auditing continues when AI is unavailable.</div>
  </AbsoluteFill>;
}

function Scope() {
  const f=useCurrentFrame();
  return <AbsoluteFill><Title frame={f}>Clear scope.<br/><span style={{color:C.light}}>Demonstrated resilience.</span></Title>
    <div style={{...at(90,407,{width:790}),...move(f,13)}}><div style={{display:'flex',alignItems:'baseline',gap:25}}><span style={{fontSize:108,fontWeight:600,lineHeight:1,color:C.light}}>20</span><span style={{fontSize:40}}>technical checks</span></div><div style={{fontSize:29,lineHeight:1.65,marginTop:32}}>Cisco IOS / IOS-XE<br/>Junos <span className="mono" style={{fontSize:26}}>set</span> output<br/>FortiOS</div><Label style={{marginTop:20}}>Declared subsets of each format</Label><div style={{marginTop:34,paddingTop:25,borderTop:`1px solid ${C.line}`,fontSize:25,color:C.amber}}>CIS / NIST / STIG / ISO candidate crosswalks<br/><span style={{display:'block',marginTop:10}}>Framework certification is outside this release.</span></div></div>
    <div style={{...at(1040,335,{width:775}),...move(f,50)}}><Label colour={C.green}>Documented local qualification</Label>{[['180,000','metadata reads · one-hour load test'],['60 / 60','audit jobs completed with PDFs'],['Recovery','Interrupted workers resumed jobs']].map(([value,desc],i)=><div key={value} style={{...move(f,72+i*32),padding:'25px 0',borderBottom:`1px solid ${C.line}`}}><div style={{fontSize:i===2?42:55,fontWeight:550}}>{value}</div><Label style={{fontSize:26,marginTop:8}}>{desc}</Label></div>)}<Label style={{fontSize:21,lineHeight:1.5,marginTop:22}}>Synthetic data · 12 logical CPUs · about 8 GB Docker memory<br/>Local measurements; no real-vendor accuracy claim.</Label></div>
  </AbsoluteFill>;
}

function Close() {
  const f=useCurrentFrame();
  return <AbsoluteFill><div style={{...at(0,183,{width:'100%',display:'flex',justifyContent:'center',alignItems:'center',gap:26}),...move(f)}}><Logo size={84}/><span style={{fontSize:83,fontWeight:650,letterSpacing:'-.03em'}}>Prooflane</span></div>
    <div style={{...at(0,365,{width:'100%',textAlign:'center'}),...move(f,12)}}><h1 style={{fontSize:90,lineHeight:1.18}}>Trace the finding.<br/><span style={{color:C.light}}>Trust the evidence.</span></h1></div>
    <Route d="M575 690 H1345" frame={f} delay={25}/>
    {['Evidence','Understanding','Human review'].map((t,i)=><div key={t} style={{...at(440+i*385,664,{width:310,textAlign:'center',padding:'10px 20px',background:C.bg,fontSize:27,color:i===2?C.amber:C.ink}),...move(f,35+i*13)}}>{t}</div>)}
    <div style={{...at(0,836,{width:'100%',textAlign:'center',fontSize:29,color:C.muted}),...move(f,76)}}>Reviewed decisions. No automatic changes to live devices.</div>
  </AbsoluteFill>;
}

const components=[PromiseScene,Problem,Workflow,Evidence,Unknown,Product,Learning,Versions,Trail,Architecture,Scope,Close];
const chapters=['Introducing Prooflane','The problem','The workflow','The evidence','The unknowns','The application','Reviewed adaptation','Versioned history','The audit trail','The architecture','Scope and validation','Trace. Trust.'];

export function Film() {
  const frame=useCurrentFrame();
  const seconds=frame/30;
  const index=scenes.findIndex(s=>seconds>=s.start&&seconds<s.start+s.duration);
  const scene=scenes[Math.max(index,0)];
  const local=frame-scene.start*30;
  const caption=captions.find(c=>seconds>=c.start&&seconds<c.end);
  return <AbsoluteFill style={{background:C.bg,color:C.ink,fontFamily:'Geist Variable, sans-serif',overflow:'hidden'}}>
    <Audio src={staticFile('master.wav')}/>
    {scenes.map((s,i)=>{const Component=components[i];return <Sequence key={s.id} from={s.start*30} durationInFrames={s.duration*30}><Component/></Sequence>;})}
    <div style={at(0,0,{height:94,width:1920,background:C.bg,display:'flex',alignItems:'center',padding:'0 90px',borderBottom:`1px solid ${C.line}`,gap:13})}><Logo size={36}/><span style={{fontSize:26,fontWeight:600}}>Prooflane</span><span style={{fontSize:23,color:C.muted,marginLeft:25}}>Timing preview · temporary voice</span><span style={{fontSize:24,color:C.muted,marginLeft:'auto'}}>{chapters[index]}</span></div>
    <div style={at(0,963,{width:1920,height:92,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',borderTop:'1px solid #252e3e'})}>{caption&&<div style={{fontSize:32,lineHeight:1.3,textAlign:'center',maxWidth:1740,color:'#f4f6fb'}}>{caption.text}</div>}</div>
    <div style={at(90,1064,{display:'flex',gap:8,width:1740})}>{scenes.map(s=><div key={s.id} style={{flex:s.duration,height:3,background:C.line,overflow:'hidden'}}><div style={{height:'100%',width:`${clamp((seconds-s.start)/s.duration)*100}%`,background:C.light}}/></div>)}</div>
    {index>0&&local<17&&<div style={at(interpolate(local,[0,17],[-600,2200]),94,{height:869,width:380,background:C.blue,transform:'skewX(-12deg)',opacity:.85,pointerEvents:'none'})}/>}
  </AbsoluteFill>;
}
