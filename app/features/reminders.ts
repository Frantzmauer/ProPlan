// ŻELAZO — Przypomnienia: powiadomienia systemowe albo baner w aplikacji.
// Moduł zawiera tylko deklaracje; kod startowy jest w __init_N, wywoływanych przez main.js w stałej kolejności.
import { S, save } from '../core/state';
import { mtScheduleReminders } from '../screens/meals';

export let notifTimers, NOTIF_SUPPORTED, REMINDER_ITEMS, btnTestNotif;

export function notifPerm(){ return NOTIF_SUPPORTED ? Notification.permission : 'unsupported'; }

export function setupReminders(){
  notifTimers.forEach(t=>clearTimeout(t));notifTimers=[];
  if(!S.reminders.on) return;
  const useSystem = NOTIF_SUPPORTED && Notification.permission==='granted';
  mtScheduleReminders(useSystem);
  REMINDER_ITEMS().forEach(it=>{
    if(!it.t)return;
    const[h,m]=it.t.split(':').map(Number);
    const now=new Date();const next=new Date();next.setHours(h,m,0,0);
    if(next<=now)next.setDate(next.getDate()+1);
    const ms=+next - +now;
    if(ms<86400000*2){
      notifTimers.push(setTimeout(function fire(){
        fireReminder(it, useSystem);
        notifTimers.push(setTimeout(fire,86400000)); // codziennie o tej samej porze
      },ms));
    }
  });
}

export function fireReminder(it, useSystem){
  // spróbuj systemowego powiadomienia; jeśli się nie uda — pokaż baner w aplikacji
  if(useSystem){
    try{ new Notification(it.title,{body:it.body}); return; }catch(e){}
  }
  showInAppReminder(it.title, it.body);
}

// baner w aplikacji — działa nawet z pliku lokalnego i na telefonie, gdy apka jest otwarta
export function showInAppReminder(title, body){
  let bar=document.getElementById('reminderBar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='reminderBar';
    bar.innerHTML='<div class="rb-in"><div class="rb-txt"><div class="rb-t"></div><div class="rb-b"></div></div><button class="rb-x">✕</button></div>';
    document.body.appendChild(bar);
    bar.querySelector('.rb-x').onclick=()=>bar.classList.remove('show');
  }
  bar.querySelector('.rb-t').textContent=title;
  bar.querySelector('.rb-b').textContent=body;
  bar.classList.add('show');
  clearTimeout(bar._hide);
  bar._hide=setTimeout(()=>bar.classList.remove('show'),8000);
}

export function refreshNotifUI(){
  const tgl=document.getElementById('notifToggle');
  const perm=notifPerm();
  const on=S.reminders.on;
  tgl.classList.toggle('on',on);
  let msg;
  if(!on) msg='Wyłączone — stuknij, aby włączyć';
  else if(perm==='granted') msg='Włączone — powiadomienia systemowe';
  else if(perm==='denied') msg='Włączone — baner w aplikacji (powiadomienia zablokowane w przeglądarce)';
  else if(perm==='unsupported') msg='Włączone — baner w aplikacji (przeglądarka nie wspiera powiadomień)';
  else msg='Włączone — baner w aplikacji';
  document.getElementById('notifState').textContent=msg;
}

export function __init_12(){

/* ============================================================
   REMINDERS (systemowe powiadomienia + baner w aplikacji jako fallback)
   ============================================================ */
notifTimers = [];
NOTIF_SUPPORTED = typeof Notification !== 'undefined';

REMINDER_ITEMS = ()=>[
  {key:'workout',t:S.reminders.workout,title:'🏋️ Czas na trening',body:'Sprawdź dzisiejszą sesję w SixMo.'},
  {key:'water',t:S.reminders.water,title:'💧 Pij wodę',body:'Cel to 3 litry dziennie. Jak stoisz?'},
  {key:'weight',t:S.reminders.weight,title:'⚖️ Zważ się',body:'Rano, na czczo. Zapisz wagę i śledź trend.'},
];
document.getElementById('notifToggle').onclick=async()=>{
  if(S.reminders.on){ // wyłącz
    S.reminders.on=false;S._settingsM=Date.now();save();setupReminders();refreshNotifUI();return;
  }
  // włącz
  S.reminders.on=true;S._settingsM=Date.now();save();setupReminders();refreshNotifUI();
  // spróbuj uzyskać zgodę na powiadomienia systemowe; jeśli się nie da — działa baner w apce
  if(NOTIF_SUPPORTED && Notification.permission==='default'){
    try{
      const p=await Notification.requestPermission();
      refreshNotifUI();
      if(p==='granted'){ try{new Notification('✅ Przypomnienia włączone',{body:'Będę Cię pilnować.'})}catch(e){} return; }
    }catch(e){ refreshNotifUI(); }
  }
  // potwierdzenie działania fallbacku
  showInAppReminder('✅ Przypomnienia włączone', NOTIF_SUPPORTED && Notification.permission==='granted' ? 'Powiadomienia systemowe aktywne.' : 'Będą pokazywać się jako baner, gdy aplikacja jest otwarta.');
};
// przycisk testowy
btnTestNotif = document.getElementById('btnTestNotif');
if(btnTestNotif) btnTestNotif.onclick=()=>{
  if(NOTIF_SUPPORTED && Notification.permission==='granted'){ try{new Notification('🔔 Test',{body:'Tak wygląda przypomnienie SixMo.'});return;}catch(e){} }
  showInAppReminder('🔔 Test przypomnienia','Tak wygląda baner w aplikacji.');
};
}
