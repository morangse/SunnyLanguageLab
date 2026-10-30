// Fake extension APIs only on the local test page; no real credentials or services.
window.errors=[];addEventListener('error',event=>errors.push(event.message));addEventListener('unhandledrejection',event=>errors.push(String(event.reason)));
window.fixtureCalls=[];
window.fixtureDownloads=[];
const originalAnchorClick=HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click=function(){if(this.download){fixtureDownloads.push(this.download);return;}return originalAnchorClick.call(this);};
window.fixtureState={settings:{enabled:true,learnLang:'en',nativeLang:'zh',fontScale:1,blurNative:true,blurLearn:false,autoPause:false,showSidebar:false,vocabHighlight:true,vocabLevel:'4500',vocabStyle:'underline',hoverPause:true,subtitleBackdrop:'soft',llmProvider:'none',geminiModel:'',anthropicModel:''},hasKeys:{gemini:false,anthropic:false},vocabCount:12};
let syncState={enabled:false,hasToken:false,endpoint:'',count:12,pending:0,lastSync:0,archive:null};
window.chrome={permissions:{request:async()=>true},storage:{onChanged:{addListener(){}}},runtime:{sendMessage:async message=>{
  fixtureCalls.push(structuredClone(message));
  if(message.type==='getState')return structuredClone(fixtureState);
  if(message.type==='preferencesPatch'){Object.assign(fixtureState.settings,message.patch);return{settings:{...fixtureState.settings}};}
  if(message.type==='saveConfig'){Object.assign(fixtureState.settings,message.settings);if(message.provider)fixtureState.hasKeys[message.provider]=!!message.key;return{settings:{...fixtureState.settings}};}
  if(message.type==='recoverLegacyAI')return{recovered:0,settings:{...fixtureState.settings}};
  if(message.type==='syncConfigure'){syncState={...syncState,enabled:true,hasToken:true,endpoint:message.endpoint};return{...syncState};}
  if(message.type==='syncDisconnect'){syncState.enabled=false;syncState.hasToken=false;return{...syncState};}
  if(message.type==='syncNow'){if(syncState.enabled)syncState.lastSync=Date.now();return{...syncState};}
  if(message.type==='syncArchive'){syncState.archive={at:Date.now()};return{...syncState};}
  if(message.type==='syncStatus')return{...syncState};
  if(message.type==='clearCache')return{cleared:0};
  if(message.type==='vocabBackup')return{backup:{schema:1,items:[]}};
  if(message.type==='vocabLegacyBackup')return{backup:null};
  if(message.type==='vocabRestore')return{added:0};
  return{error:'Unknown fixture request'};
}}};
