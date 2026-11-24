// Draft model for a future ledger adapter. No ledger writes or UI are enabled.
export function expenseDraft(fields,id=crypto.randomUUID()){
  const {amountMinor,currency,payerId,date,category,note=''}=fields;
  const validDate=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&
    Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date;
  if(!/^[\da-f-]{36}$/i.test(id)||!Number.isSafeInteger(amountMinor)||amountMinor<=0||
    !/^[A-Z]{3}$/.test(currency)||typeof payerId!=='string'||!payerId||payerId.length>128||
    !validDate||typeof category!=='string'||!category||category.length>80||
    typeof note!=='string'||note.length>1600)throw Error('支出欄位格式不符。');
  return {id:'expense~'+id,value:{amountMinor,currency,payerId,date,category,note}};
}
