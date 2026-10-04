// Final durability is a separate acceptance boundary from simulated years.
export async function finishJournal(journal){
  let error=null;
  try{await journal.flush();}catch(e){error=String(e?.message||e);}
  return {status:journal.status(),error};
}
export function assertJournalComplete(result){
  const s=result?.status;
  if(result?.error||!s||s.fault||s.modelFault||!Number.isInteger(s.records)||s.records<1||s.committed!==s.records-1||s.pendingBytes!==0||s.pendingChunks!==0)
    throw new Error('Incomplete final storage journal: '+JSON.stringify(result));
  return result;
}
