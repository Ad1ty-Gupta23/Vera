import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const node = (id, x, y, w, h, title, sub, kind='service') => ({id,x,y,w,h,title,sub,kind});
const edge = (id, from, to, points, label='', both=false, dashed=false) => ({id,from,to,points,label,both,dashed});
const pages = [
  {name:'Architecture and tech stack', title:'System architecture and technology stack', caption:'Technology labels identify the role of each component in the business assistant', nodes:[
    node('browser',60,115,280,130,'Browser interface','Dashboard: React / Vite / Tailwind\nWidget: JavaScript\nWeb Audio + AudioWorklet','client'),
    node('aai',820,115,400,105,'AssemblyAI Voice Agent API','Speech recognition, turn-taking,\nLLM routing and voice output','voice'),
    node('api',60,335,280,100,'Python + FastAPI','Pydantic request validation\nGoogle OAuth + scoped endpoints'),
    node('pipeline',470,335,300,100,'Business assistant','Conversation context + RAG\nAction and handoff routing'),
    node('groq',880,335,340,100,'Groq inference','Answer from business profile\nand retrieved knowledge','voice'),
    node('sql',60,550,280,90,'SQLite + SQLAlchemy','Businesses, conversations,\ncases and call records','data'),
    node('chroma',470,550,300,90,'Chroma + embeddings','Business-filtered retrieval\nSentence Transformers','data'),
    node('actions',880,550,340,90,'Business outcomes','Confirmed requests + handoffs\nOptional Gmail API follow-up'),
  ], edges:[
    edge('audio','browser','aai',[[340,167],[820,167]],'Direct audio WebSocket',true),
    edge('relay','browser','api',[[200,245],[200,335]],'Token / tool relay',true),
    edge('route','api','pipeline',[[340,385],[470,385]],'Request'),
    edge('llm','pipeline','groq',[[770,385],[880,385]],'Grounding',true),
    edge('persist','api','sql',[[200,435],[200,550]],'Persist',true),
    edge('rag','pipeline','chroma',[[620,435],[620,550]],'Retrieve',true),
    edge('act','pipeline','actions',[[770,410],[815,410],[815,595],[880,595]],'Route',false),
  ], note:'The browser relays JSON-Schema tool requests to VERA and returns tool results to AssemblyAI. API keys remain on the backend.'},
  {name:'Workflow and owner knowledge', title:'Customer workflow and owner-controlled knowledge', caption:'Customers guide the conversation. Owners approve the knowledge used in future answers.', nodes:[
    node('ask',50,155,240,105,'Customer asks','Speak or type in\nthe website widget','client'),
    node('context',355,155,245,105,'VERA checks context','Business-scoped retrieval\nHistory + approved knowledge'),
    node('answer',665,155,245,105,'VERA responds','Spoken answer + structured\ntext with source references','voice'),
    node('check',975,155,245,105,'Resolution check','Did this answer help?\nRecord customer feedback'),
    node('request',50,425,350,135,'Action requested','Collect relevant details\nCustomer reviews and confirms\nTrack in Action Center'),
    node('gap',460,425,350,135,'Knowledge missing','Log the unanswered question\nOwner approves a verified answer\nIndex for future retrieval','data'),
    node('handoff',870,425,350,135,'Human help needed','Route to the relevant category\nRetain conversation context\nOwner accepts and completes'),
  ], edges:[
    edge('a','ask','context',[[290,207],[355,207]]),
    edge('b','context','answer',[[600,207],[665,207]]),
    edge('c','answer','check',[[910,207],[975,207]]),
    edge('d','context','request',[[415,260],[415,340],[225,340],[225,425]],'Action intent',false,true),
    edge('e','context','gap',[[545,260],[545,345],[635,345],[635,425]],'Unknown fact',false,true),
    edge('f','check','handoff',[[1098,260],[1098,425]],'Unresolved / human request',false,true),
    edge('learn','gap','context',[[460,490],[435,490],[435,285],[477,285],[477,260]],'Approved knowledge',false,true),
  ], note:'Appointment and reservation flows capture requests. The current prototype does not guarantee a booking in an external scheduling system.'}
];

const colors={client:['EAF1FF','4878C8'],voice:['EAE7FF','7763C5'],service:['F4F7FA','8C9BAD'],data:['E2F5EF','3B947D']};
function drawioPage(p,index){
  let cells='<mxCell id="0"/><mxCell id="1" parent="0"/>';
  const text=(id,value,x,y,w,h,size,color,bold=false)=>`<mxCell id="${id}" value="${esc(value)}" style="text;html=0;align=left;verticalAlign=middle;whiteSpace=wrap;fontFamily=Arial;fontSize=${size};fontColor=${color};fontStyle=${bold?1:0};" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  cells+=text('title',p.title,50,25,1180,48,34,'142A43',true)+text('caption',p.caption,50,76,1180,26,18,'54687C');
  for(const n of p.nodes){ const c=colors[n.kind]; cells+=`<mxCell id="${n.id}" value="${esc(n.title+'\n'+n.sub)}" style="rounded=1;whiteSpace=wrap;html=0;arcSize=8;fillColor=#${c[0]};strokeColor=#${c[1]};fontFamily=Arial;fontSize=19;fontColor=#142A43;spacing=12;" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`; }
  for(const e of p.edges){const src=p.nodes.find(n=>n.id===e.from),dst=p.nodes.find(n=>n.id===e.to); const first=e.points[0],last=e.points.at(-1); cells+=`<mxCell id="${e.id}" value="${esc(e.label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=block;startArrow=${e.both?'block':'none'};strokeColor=#63798F;strokeWidth=2;fontFamily=Arial;fontSize=15;fontColor=#42566C;labelBackgroundColor=#FFFFFF;dashed=${e.dashed?1:0};exitX=${(first[0]-src.x)/src.w};exitY=${(first[1]-src.y)/src.h};exitDx=0;exitDy=0;entryX=${(last[0]-dst.x)/dst.w};entryY=${(last[1]-dst.y)/dst.h};entryDx=0;entryDy=0;" edge="1" parent="1" source="${e.from}" target="${e.to}"><mxGeometry relative="1" as="geometry"><Array as="points">${e.points.slice(1,-1).map(pt=>`<mxPoint x="${pt[0]}" y="${pt[1]}"/>`).join('')}</Array></mxGeometry></mxCell>`;}
  cells+=text('note',p.note,50,665,1175,40,15,'54687C');
  return `<diagram id="vera-${index}" name="${esc(p.name)}"><mxGraphModel dx="1280" dy="720" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1280" pageHeight="720" background="#FFFFFF"><root>${cells}</root></mxGraphModel></diagram>`;
}
function svg(p){
  const label=(x,y,value,size=19,color='#142A43',weight=400,anchor='start')=>`<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
  let out=`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><rect width="1280" height="720" fill="white"/><defs><marker id="end" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 Z" fill="#63798F"/></marker></defs>`;
  out+=label(50,61,p.title,34,'#142A43',700)+label(50,94,p.caption,18,'#54687C');
  for(const e of p.edges){out+=`<polyline points="${e.points.map(pt=>pt.join(',')).join(' ')}" fill="none" stroke="#63798F" stroke-width="2" marker-end="url(#end)" ${e.both?'marker-start="url(#end)"':''} ${e.dashed?'stroke-dasharray="6 5"':''}/>`; const j=Math.floor((e.points.length-1)/2),a=e.points[j],b=e.points[j+1]; const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2; if(e.label){const vertical=a[0]===b[0],nearRight=vertical&&x>950;out+=label(x+(vertical?(nearRight?-10:10):0),y-10,e.label,14,'#42566C',400,vertical?(nearRight?'end':'start'):'middle');}}
  for(const n of p.nodes){const c=colors[n.kind];out+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="#${c[0]}" stroke="#${c[1]}"/>`;out+=label(n.x+n.w/2,n.y+30,n.title,21,'#142A43',700,'middle');n.sub.split('\n').forEach((line,i)=>out+=label(n.x+n.w/2,n.y+57+i*23,line,17,'#42566C',400,'middle'));}
  out+=label(50,689,p.note,13,'#54687C');return out+'</svg>';
}
await fs.writeFile(path.join(dir,'VERA-architecture-workflow.drawio'),`<?xml version="1.0" encoding="UTF-8"?><mxfile host="app.diagrams.net" agent="VERA presentation" version="24.7.17">${pages.map(drawioPage).join('')}</mxfile>`);
for(let i=0;i<pages.length;i++) await fs.writeFile(path.join(dir,i===0?'VERA-architecture.svg':'VERA-workflow.svg'),svg(pages[i]));
console.log('Created editable draw.io architecture and workflow, plus two SVG previews.');
