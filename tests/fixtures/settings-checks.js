window.runSettingsChecks=async function(){
  const $=s=>document.querySelector(s),results=[],wait=ms=>new Promise(r=>setTimeout(r,ms));
  async function until(fn){for(let i=0;i<100;i++){if(fn())return;await wait(20);}throw Error('Settings UI timeout');}
  function assert(value,name){if(!value)throw Error(name);results.push(name);}
  await until(()=>$('#vocab-count').textContent.includes('12'));
  assert(!errors.length,'Settings initialize without a selector or runtime failure');
  assert($('#provider').value==='none','AI defaults are loaded from the background');
  $('#provider').value='gemini';$('#provider').dispatchEvent(new Event('change'));
  $('#model').value='fixture-model';$('#api-key').value='fixture-private-key';
  $('#ai-form').requestSubmit();await until(()=>$('#ai-message').textContent.includes('已保存'));
  assert(!$('#api-key').value&&fixtureState.hasKeys.gemini,'Saving AI clears the input and retains the key only in storage');
  assert($('#model').value==='fixture-model','AI configuration reloads after save');
  $('#recover-ai').click();await until(()=>$('#ai-message').textContent.includes('没有可恢复'));
  assert($('#ai-message').textContent.includes('当前密钥'),'Legacy recovery is functional and keeps an existing key');
  if($('.section-switch')){
    $('#model').value='unsaved-fixture-model';$('.section-switch [data-section="sync"]').click();await until(()=>!$('#sync').hidden);
    assert($('#ai').hidden&&!$('#sync').hidden,'Compact navigation displays exactly one settings section');
    assert(getComputedStyle(document.documentElement).backgroundColor==='rgb(24, 35, 43)','Compact settings share the dark study surface');
    $('.section-switch [data-section="ai"]').click();await until(()=>!$('#ai').hidden);
    assert($('#model').value==='unsaved-fixture-model','Switching settings sections preserves unsaved form input');
    $('.section-switch [data-section="sync"]').click();await until(()=>!$('#sync').hidden);
  }else{
    assert($('#preferences [name="blurNative"]').checked,'The full settings page initializes practice preferences');
  }
  $('#sync-endpoint').value='https://fixture.user.workers.dev';$('#sync-endpoint').dispatchEvent(new Event('input'));
  $('#sync-token').value='fixture-personal-token-0000000000000000';$('#sync-connect').click();
  await until(()=>$('#sync-summary').textContent.includes('已连接'));
  assert(!$('#sync-token').value,'Saving a sync connection clears the token field');
  assert(!$('#sync-now').disabled&&!$('#sync-archive').disabled,'Connected sync and archive controls are available');
  $('#sync-archive').closest('details').open=true;
  $('#sync-archive').click();await until(()=>$('#sync-message').textContent.includes('已归档'));
  assert(fixtureCalls.some(m=>m.type==='syncArchive'),'Obsidian archive remains functional');
  $('#vocab-backup').click();await until(()=>fixtureDownloads.includes('Sunny-vocabulary-backup.json'));
  assert(fixtureCalls.some(m=>m.type==='vocabBackup'),'JSON backup remains available in the compact drawer');
  const data=new DataTransfer();data.items.add(new File([JSON.stringify({schema:1,items:[]})],'fixture-backup.json',{type:'application/json'}));$('#vocab-import-file').files=data.files;$('#vocab-import-file').dispatchEvent(new Event('change'));
  await until(()=>fixtureCalls.some(m=>m.type==='vocabRestore'));
  assert(fixtureCalls.some(m=>m.type==='vocabRestore'),'JSON backup import remains available');
  assert(document.documentElement.scrollWidth<=innerWidth,'Settings have no horizontal overflow');
  assert(!errors.length,'Settings interactions finish without runtime errors');
  return{passed:results.length,results};
};
