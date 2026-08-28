// Le vestiaire du relais : creer, inviter, repondre, ordonner.
//
// Ce qu'on cherche a prendre en defaut : une equipe qui pourrait courir sans
// que les quatre aient accepte, ou sans ordre. Les deux se ressemblent a
// l'ecran et n'ont pas du tout le meme sens.
const B='http://127.0.0.1:8788';
const H={'Content-Type':'application/json','X-Sprinter-Test':'ECRAN1'};
const post=(u,b)=>fetch(B+u,{method:'POST',headers:H,body:JSON.stringify(b)}).then(async r=>({s:r.status,d:await r.json().catch(()=>({}))}));
const get=u=>fetch(B+u,{headers:H}).then(async r=>({s:r.status,d:await r.json().catch(()=>({}))}));
let e=0; const ok=(n,c,d)=>{console.log(`   ${c?'✓':'✗'} ${n}${c||!d?'':' — '+d}`); if(!c)e++;};

const m = Math.random().toString(36).slice(2,6).toUpperCase();
const [A,Bq,C,D,E2] = ['Ana'+m,'Bo'+m,'Cy'+m,'Dia'+m,'Eli'+m];

console.log('\n── MONTER UNE EQUIPE ────────────────────────────────────────');
const cree = await post('/relay/team', { name:'Fusee'+m, creator:A, members:[Bq,C,D] });
ok('l equipe se cree', cree.s===200 && !!cree.d.equipe?.id, JSON.stringify(cree.d).slice(0,90));
const id = cree.d.equipe.id;

let t = (await get('/relay/team/'+id)).d.equipe;
ok('quatre membres', t.membres.length===4, String(t.membres.length));
ok('le createur est deja dedans', t.membres.find(x=>x.nom===A)?.etat==='in');
ok('les trois autres sont invites', t.membres.filter(x=>x.etat==='invited').length===3);
ok('il manque trois reponses', t.manquants===3, String(t.manquants));

console.log('\n── LES REPONSES ─────────────────────────────────────────────');
await post('/relay/answer', { id, name:Bq, accept:true });
await post('/relay/answer', { id, name:C, accept:true });
t = (await get('/relay/team/'+id)).d.equipe;
ok('a trois sur quatre, l equipe n est pas complete', t.manquants===1, String(t.manquants));
await post('/relay/answer', { id, name:D, accept:true });
t = (await get('/relay/team/'+id)).d.equipe;
ok('les quatre acceptent, l equipe est complete', t.manquants===0);
// Le serveur attribue les relais au fur et a mesure : une equipe complete a
// deja un ordre, celui des acceptations. Le fixer, c'est le changer.
ok('un ordre existe deja, celui des acceptations',
   t.membres.every(x=>x.relais>=1 && x.relais<=4), JSON.stringify(t.membres.map(x=>x.relais)));

console.log('\n── L ORDRE DES RELAYEURS ────────────────────────────────────');
const cles = t.membres.map(x=>x.cle);
const r = await post('/relay/order', { id, order:[cles[3],cles[0],cles[2],cles[1]] });
ok('l ordre s enregistre', r.s===200, JSON.stringify(r.d).slice(0,80));
t = (await get('/relay/team/'+id)).d.equipe;
ok('les quatre portent un rang', t.membres.every(x=>x.relais>=1 && x.relais<=4),
   JSON.stringify(t.membres.map(x=>[x.nom,x.relais])));
ok('les rangs vont de 1 a 4 sans doublon',
   JSON.stringify([...t.membres.map(x=>x.relais)].sort())===JSON.stringify([1,2,3,4]));
console.log('   ordre : ' + [...t.membres].sort((a,b)=>a.relais-b.relais).map(x=>`${x.relais}.${x.nom}`).join('  '));

console.log('\n── MES EQUIPES ET MES INVITATIONS ───────────────────────────');
const vueA = (await get('/relay/mine?name='+encodeURIComponent(A))).d;
ok('le createur voit son equipe', (vueA.equipes||[]).some(x=>x.id===id));
ok('et n a pas d invitation en attente', !(vueA.invitations||[]).some(x=>x.id===id));

// Une composition differente : les memes quatre auraient renvoye l'equipe
// existante, ce que la regle veut precisement.
const cree2 = await post('/relay/team', { name:'Autre'+m, creator:Bq, members:[A,C,E2] });
const vueA2 = (await get('/relay/mine?name='+encodeURIComponent(A))).d;
ok('une invitation apparait du bon cote',
   (vueA2.invitations||[]).some(x=>x.id===cree2.d.equipe.id));

console.log('\n── LA REGLE : UNE EQUIPE EST SA COMPOSITION ─────────────────');
const meme = await post('/relay/team', { name:'AutreNom'+m, creator:D, members:[C,Bq,A] });
ok('les memes quatre, dans un autre ordre, ne creent pas une seconde equipe',
   meme.s !== 200 || meme.d.equipe?.id === id,
   `statut ${meme.s} · ${JSON.stringify(meme.d).slice(0,80)}`);

console.log('\n' + '─'.repeat(62));
console.log(e===0 ? '   TOUT PASSE.' : `   ${e} VERIFICATION(S) EN ECHEC.`);
process.exit(e?1:0);
