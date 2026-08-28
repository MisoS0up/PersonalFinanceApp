const KEY="dans-wealth-v1";
let data=JSON.parse(localStorage.getItem(KEY)||'null')||{
 savings:[
  {name:"Maya Savings",amount:0},{name:"MariBank",amount:0},{name:"CIMB Savings",amount:0},
  {name:"GoTyme",amount:0},{name:"Future Savings",amount:0},{name:"Emergency Fund",amount:0}
 ],
 expenses:[],activity:[],stocks:[],goal:100000
};
data.profileName=data.profileName||"My Wealth";
data.budget=data.budget||{income:15000,needs:50,wants:30,savings:15,invest:5};
data.expenses=data.expenses||[];
data.activity=data.activity||[];
data.savings.forEach(account=>{account.notes=account.notes||[]});
if(!data.savings.some(account=>account.name.toLowerCase().includes("unionbank")))data.savings.push({name:"Unionbank Payroll",amount:0,notes:[]});
data.stocks=(data.stocks||[]).map(stock=>({...stock,fundingSources:stock.fundingSources||((stock.fundingAccount&&stock.purchaseAmount)?[{account:stock.fundingAccount,amount:Number(stock.purchaseAmount)}]:[])}));
const dateKey=date=>{const year=date.getFullYear(),month=String(date.getMonth()+1).padStart(2,"0"),day=String(date.getDate()).padStart(2,"0");return `${year}-${month}-${day}`};
const today=()=>dateKey(new Date());
data.savings=data.savings.filter(item=>{
 if(!item.name.startsWith("Expense - "))return true;
 data.expenses.push({name:item.name.slice(10),amount:Math.abs(Number(item.amount||0)),date:today()});
 return false;
});
const peso=n=>"₱"+Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2,maximumFractionDigits:2});
const usd=n=>"$"+Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const HIDDEN_KEY=KEY+"-hide-values";
const money=(formatter,n)=>localStorage.getItem(HIDDEN_KEY)==="1"?"••••":formatter(n);
const hiddenNote=note=>localStorage.getItem(HIDDEN_KEY)==="1"?note.replace(/(?:₱|\$)[\d,]+(?:\.\d{2})?/g,"••••"):note;
const DIRTY_KEY=KEY+"-sync-dirty";
function save(){localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem(DIRTY_KEY,"1");render();syncToServer()}
function setSyncStatus(status){const element=document.querySelector("#syncStatus");if(element)element.textContent=status}
async function syncToServer(){
 if(!navigator.onLine){setSyncStatus("Offline");return}
 setSyncStatus("Syncing...");
 try{const response=await fetch("/api/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data,updatedAt:new Date().toISOString()})});if(!response.ok)throw new Error("sync failed");localStorage.removeItem(DIRTY_KEY);setSyncStatus("Synced")}
 catch(error){setSyncStatus("Offline");}
}
async function syncFromServer(){
 if(!navigator.onLine){setSyncStatus("Offline");return}
 if(localStorage.getItem(DIRTY_KEY)==="1"){syncToServer();return}
 try{const response=await fetch("/api/data");if(!response.ok)throw new Error("sync failed");const remote=await response.json();if(remote.data){data=remote.data;normalizeData();localStorage.setItem(KEY,JSON.stringify(data));render();}else if(data.savings.some(account=>Number(account.amount||0)!==0)||data.expenses.length||data.stocks.length)syncToServer();setSyncStatus("Synced")}
 catch(error){setSyncStatus("Local");}
}
function normalizeData(){
 data.profileName=data.profileName||"My Wealth";data.budget=data.budget||{income:15000,needs:50,wants:30,savings:15,invest:5};data.expenses=data.expenses||[];data.activity=data.activity||[];data.savings=data.savings||[];data.savings.forEach(account=>{account.notes=account.notes||[]});data.stocks=(data.stocks||[]).map(stock=>({...stock,fundingSources:stock.fundingSources||((stock.fundingAccount&&stock.purchaseAmount)?[{account:stock.fundingAccount,amount:Number(stock.purchaseAmount)}]:[])}));
}
function totalSavings(){return data.savings.reduce((a,x)=>a+Number(x.amount||0),0)}
function totalExpenses(){return data.expenses.reduce((a,x)=>a+Number(x.amount||0),0)}
function totalInvestments(){return data.stocks.reduce((a,x)=>a+(Number(x.shares)||0)*(Number(x.latestPrice)||0)*58,0)}
function render(){
 const s=totalSavings(),i=totalInvestments(),n=s+i;
 document.querySelector("#appName").textContent=data.profileName;
 document.querySelector("#totalSavings").textContent=money(peso,s);
 document.querySelector("#totalInvestments").textContent=money(peso,i);
 document.querySelector("#totalExpenses").textContent=peso(totalExpenses());
 document.querySelector("#netWorth").textContent=money(peso,n);
 const pct=Math.min(100,n/data.goal*100);
 document.querySelector("#goalPercent").textContent=Math.round(pct)+"%";
 document.querySelector("#goalBar").style.width=pct+"%";
 document.querySelector("#goalTarget").textContent=money(peso,data.goal);
 document.querySelector("#goalAmount").textContent=money(peso,n);
 document.querySelector("#budgetIncomeDisplay").textContent=peso(data.budget.income);
 document.querySelector("#budgetNeedsPercent").textContent=data.budget.needs+"%";
 document.querySelector("#budgetNeedsAmount").textContent=peso(data.budget.income*data.budget.needs/100);
 document.querySelector("#budgetWantsPercent").textContent=data.budget.wants+"%";
 document.querySelector("#budgetWantsAmount").textContent=peso(data.budget.income*data.budget.wants/100);
 document.querySelector("#budgetSavingsPercent").textContent=data.budget.savings+"%";
 document.querySelector("#budgetSavingsAmount").textContent=peso(data.budget.income*data.budget.savings/100);
 document.querySelector("#budgetInvestPercent").textContent=data.budget.invest+"%";
 document.querySelector("#budgetInvestAmount").textContent=peso(data.budget.income*data.budget.invest/100);
 const valuesHidden=localStorage.getItem(HIDDEN_KEY)==="1";
 document.body.classList.toggle("privacy-mode",valuesHidden);
 document.querySelector("#eyeBtn").textContent=valuesHidden?"○":"◉";
 document.querySelector("#eyeBtn").title=valuesHidden?"Show values":"Hide values";
 document.querySelector("#eyeBtn").setAttribute("aria-label",document.querySelector("#eyeBtn").title);
 document.querySelector("#savingsList").innerHTML=data.savings.map((x,idx)=>`<div class="item sortable-item" draggable="true" data-index="${idx}"><div><div class="name">${escapeHtml(x.name)}</div><small>Savings</small>${x.notes?.length?`<div class="bank-notes">${x.notes.slice(-3).reverse().map(note=>`<small>${escapeHtml(idx===0?note:hiddenNote(note))}</small>`).join("")}</div>`:""}</div><div class="right"><strong>${idx===0?peso(x.amount):money(peso,x.amount)}</strong><button class="add-saving" onclick="addToSaving(${idx})" title="Add to ${escapeHtml(x.name)}" aria-label="Add to ${escapeHtml(x.name)}">+</button><button class="delete" onclick="removeSaving(${idx})" title="Delete ${escapeHtml(x.name)}" aria-label="Delete ${escapeHtml(x.name)}">×</button><span class="drag-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span></div></div>`).join("");
 const recentExpenses=data.expenses.map((expense,index)=>({expense,index})).sort((a,b)=>(b.expense.date||"").localeCompare(a.expense.date||"")||b.index-a.index);
 document.querySelector("#expensesList").innerHTML=recentExpenses.length?recentExpenses.slice(0,5).map(({expense,index})=>expenseRow(expense,index)).join(""):`<div class="item"><div><div class="name">No expenses yet</div><small>Add your first expense to start tracking</small></div></div>`;
 renderExpenseHistory();
 document.querySelector("#stocksList").innerHTML=data.stocks.length?data.stocks.map((x,idx)=>{
   const invested=x.shares*x.avgCost, value=x.shares*x.latestPrice, pnl=value-invested;
  const fundingNames=[...new Set((x.fundingSources||[]).map(source=>source.account))];
  return `<div class="item sortable-item" draggable="true" data-index="${idx}"><div><div class="name">${escapeHtml(x.ticker.toUpperCase())}</div><small>${money(String,x.shares+" shares")} · ${money(usd,x.latestPrice)}${fundingNames.length?" · Paid from "+escapeHtml(fundingNames.join(", ")):""}</small></div><div class="right"><strong>${money(usd,value)}</strong><small>${pnl>=0?"+":""}${money(usd,pnl)}</small><button class="add-saving" onclick="addToStock(${idx})" title="Add to ${escapeHtml(x.ticker.toUpperCase())}" aria-label="Add to ${escapeHtml(x.ticker.toUpperCase())}">+</button><button class="delete" onclick="removeStock(${idx})" title="Delete ${escapeHtml(x.ticker.toUpperCase())}" aria-label="Delete ${escapeHtml(x.ticker.toUpperCase())}">×</button><span class="drag-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span></div></div>`
 }).join(""):`<div class="item"><div><div class="name">No investments yet</div><small>Add VOO, AAPL, MSFT, etc.</small></div></div>`;
 setupSortable("#savingsList", "savings");setupSortable("#stocksList", "stocks");
 drawChart();
}
function expenseRow(expense,index){return `<div class="item"><div><div class="name">${escapeHtml(expense.name)}</div><small>${expense.date||"Expense"}${expense.account?" · Paid from "+escapeHtml(expense.account):""}</small></div><div class="right"><strong>${peso(expense.amount)}</strong><button class="delete" onclick="removeExpense(${index})" title="Delete ${escapeHtml(expense.name)}" aria-label="Delete ${escapeHtml(expense.name)}">×</button></div></div>`}
function renderExpenseHistory(){
 const cutoff=new Date();cutoff.setDate(cutoff.getDate()-29);const cutoffKey=dateKey(cutoff);
 const history=data.expenses.map((expense,index)=>({expense,index})).filter(({expense})=>(expense.date||"")>=cutoffKey).sort((a,b)=>(b.expense.date||"").localeCompare(a.expense.date||"")||b.index-a.index);
 document.querySelector("#expenseHistoryList").innerHTML=history.length?`<div class="expense-table-head"><span>Date</span><span>Expense</span><span>Account</span><span class="amount-col">Amount</span><span></span></div>${history.map(({expense,index})=>expenseHistoryRow(expense,index)).join("")}`:`<div class="item"><div><div class="name">No expenses in the last month</div><small>Your 30-day history will appear here</small></div></div>`;
}
function expenseHistoryRow(expense,index){return `<div class="expense-table-row"><span>${escapeHtml(expense.date||"-")}</span><span>${escapeHtml(expense.name)}</span><span>${escapeHtml(expense.account||"-")}</span><strong class="amount-col">${peso(expense.amount)}</strong></div>`}
function setupSortable(selector,key){
 const list=document.querySelector(selector);let draggedIndex;
 list.querySelectorAll(".sortable-item").forEach(item=>{
  item.addEventListener("dragstart",()=>{draggedIndex=Number(item.dataset.index);item.classList.add("dragging")});
  item.addEventListener("dragend",()=>item.classList.remove("dragging"));
  item.addEventListener("dragover",event=>event.preventDefault());
  item.addEventListener("drop",event=>{event.preventDefault();const targetIndex=Number(item.dataset.index);if(draggedIndex===targetIndex)return;const moved=data[key].splice(draggedIndex,1)[0];data[key].splice(targetIndex,0,moved);save()});
 });
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
window.removeSaving=i=>{data.savings.splice(i,1);save()}
window.removeExpense=i=>{const expense=data.expenses[i];if(expense?.account){const account=data.savings.find(x=>x.name===expense.account);if(account){account.amount=Number(account.amount||0)+Number(expense.amount||0);if(expense.accountNote)account.notes=account.notes.filter(note=>note!==expense.accountNote)}}data.expenses.splice(i,1);save()}
window.removeStock=i=>{const stock=data.stocks[i];(stock?.fundingSources||[]).forEach(source=>{const account=data.savings.find(x=>x.name===source.account);if(account)account.amount=Number(account.amount||0)+Number(source.amount||0)});data.stocks.splice(i,1);save()}
window.addToSaving=i=>{mode="saving";entryName.value=data.savings[i].name;entryAmount.value="";prepareEntryDialog();entryDialog.showModal();entryAmount.focus()}
window.addToStock=i=>{const stock=data.stocks[i],lastFunding=stock.fundingSources?.at(-1)?.account||stock.fundingAccount||"";prepareStockDialog();ticker.value=stock.ticker;investmentAmount.value="";avgCost.value=stock.latestPrice;latestPrice.value=stock.latestPrice;investmentAccount.value=lastFunding;stockDialog.showModal();investmentAmount.focus()}
let mode="saving";
const prepareEntryDialog=()=>{document.querySelector("#expenseAccountField").hidden=mode!=="expense";document.querySelector("#dialogTitle").textContent=mode==="expense"?"Add Expense":"Add Entry";document.querySelector("#expenseAccount").innerHTML='<option value="">No linked account</option>'+data.savings.map(x=>`<option value="${escapeHtml(x.name)}">${escapeHtml(x.name)}</option>`).join("")}
document.querySelector("#addSaving").onclick=()=>{mode="saving";prepareEntryDialog();entryDialog.showModal()}
document.querySelector("#addExpense").onclick=()=>{mode="expense";prepareEntryDialog();entryDialog.showModal()}
document.querySelector("#expenseHistory").onclick=()=>{renderExpenseHistory();expenseHistoryDialog.showModal()}
document.querySelector("#addStock").onclick=()=>{prepareStockDialog();stockDialog.showModal()}
document.querySelector("#quickSavings").onclick=()=>{mode="saving";prepareEntryDialog();entryDialog.showModal()}
document.querySelector("#quickInvest").onclick=()=>{prepareStockDialog();stockDialog.showModal()}
document.querySelector("#quickExpense").onclick=()=>{mode="expense";prepareEntryDialog();entryDialog.showModal()}
document.querySelector("#transferFunds").onclick=()=>{prepareTransferDialog();transferDialog.showModal()}
document.querySelector("#cancelEntry").onclick=()=>{entryForm.reset();entryDialog.close()}
document.querySelector("#cancelStock").onclick=()=>{stockForm.reset();investmentError.textContent="";stockDialog.close()}
document.querySelector("#cancelTransfer").onclick=()=>{transferForm.reset();transferError.textContent="";transferDialog.close()}
document.querySelector("#entryForm").addEventListener("submit",e=>{
 e.preventDefault();let name=entryName.value.trim(),amount=Number(entryAmount.value),account=expenseAccount.value;
 if(mode==="saving"){
  const existing=data.savings.find(x=>x.name.trim().toLowerCase()===name.toLowerCase());
  if(existing)existing.amount=Number(existing.amount||0)+amount;
  else data.savings.push({name,amount});
  data.activity.push({type:"saving",name,amount,date:today()});
 }else{
  const linkedAccount=data.savings.find(x=>x.name===account);
  if(linkedAccount)linkedAccount.amount=Number(linkedAccount.amount||0)-amount;
  const accountNote=linkedAccount?`${today()} · Spent ${peso(amount)} on ${name}`:"";
  if(linkedAccount){linkedAccount.notes.push(accountNote);linkedAccount.notes=linkedAccount.notes.slice(-3)}
  data.expenses.push({name,amount,account,accountNote,date:today()});
  data.activity.push({type:"expense",name,amount,date:today()});
 }
 entryForm.reset();entryDialog.close();save();
});
document.querySelector("#stockForm").addEventListener("submit",e=>{
 e.preventDefault();const symbol=ticker.value.trim().toUpperCase(),investmentUsd=Number(investmentAmount.value),newAvgCost=Number(avgCost.value),newLatestPrice=Number(latestPrice.value),newShares=investmentUsd/newAvgCost,fundingAccount=investmentAccount.value,purchaseAmount=investmentUsd*58;
 const linkedAccount=data.savings.find(account=>account.name===fundingAccount);
 if(!Number.isFinite(investmentUsd)||investmentUsd<1||!Number.isFinite(newAvgCost)||newAvgCost<=0){investmentError.textContent="Enter an investment of at least $1.00 and a valid average cost.";return}
 if(linkedAccount&&Number(linkedAccount.amount||0)<purchaseAmount){investmentError.textContent=`${fundingAccount} has only ${peso(linkedAccount.amount)} available.`;return}
 const existing=data.stocks.find(stock=>stock.ticker.toUpperCase()===symbol);
 if(existing){const totalShares=Number(existing.shares||0)+newShares;existing.avgCost=((Number(existing.shares||0)*Number(existing.avgCost||0))+(newShares*newAvgCost))/totalShares;existing.shares=totalShares;existing.latestPrice=newLatestPrice;existing.purchaseAmount=Number(existing.purchaseAmount||0)+purchaseAmount;existing.fundingSources=existing.fundingSources||[];if(fundingAccount)existing.fundingSources.push({account:fundingAccount,amount:purchaseAmount})}
 else data.stocks.push({ticker:symbol,shares:newShares,avgCost:newAvgCost,latestPrice:newLatestPrice,fundingAccount,purchaseAmount,fundingSources:fundingAccount?[{account:fundingAccount,amount:purchaseAmount}]:[]});
 if(linkedAccount)linkedAccount.amount=Number(linkedAccount.amount||0)-purchaseAmount;
 stockForm.reset();stockDialog.close();save();
});
document.querySelector("#transferForm").addEventListener("submit",e=>{
 e.preventDefault();const source=transferSource.value,destination=transferDestination.value,amount=Number(transferAmount.value),note=transferNote.value.trim();
 const from=data.savings.find(account=>account.name===source),to=data.savings.find(account=>account.name===destination);
 if(!from||!to||from===to){transferError.textContent="Choose two different accounts.";return}
 if(!Number.isFinite(amount)||amount<=0){transferError.textContent="Enter a transfer amount greater than zero.";return}
 if(Number(from.amount||0)<amount){transferError.textContent=`${source} has only ${peso(from.amount)} available.`;return}
 from.amount=Number(from.amount||0)-amount;to.amount=Number(to.amount||0)+amount;
 const detail=note||`Transfer from ${source}`;
 from.notes.push(`${today()} · Sent ${peso(amount)} to ${destination}${note?` · ${note}`:""}`);
 to.notes.push(`${today()} · Received ${peso(amount)} from ${source}${note?` · ${note}`:""}`);
 from.notes=from.notes.slice(-3);to.notes=to.notes.slice(-3);
 data.activity.push({type:"transfer",name:detail,amount,date:today()});
 transferForm.reset();transferDialog.close();save();
});
document.querySelectorAll("[data-goal]").forEach(b=>b.onclick=()=>{data.goal=Number(b.dataset.goal);save()});
document.querySelectorAll("[data-range]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-range]").forEach(x=>x.classList.remove("active"));b.classList.add("active");drawChart(b.dataset.range)});
document.querySelector("#settingsBtn").onclick=()=>{profileName.value=data.profileName;settingsDialog.showModal();profileName.focus()};
document.querySelector("#eyeBtn").onclick=()=>{localStorage.setItem(HIDDEN_KEY,localStorage.getItem(HIDDEN_KEY)==="1"?"0":"1");render()};
document.querySelector("#cancelSettings").onclick=()=>settingsDialog.close();
document.querySelector("#settingsForm").addEventListener("submit",e=>{e.preventDefault();const name=profileName.value.trim();if(!name)return;data.profileName=name;settingsDialog.close();save()});
document.querySelector("#budgetSettings").onclick=()=>{budgetMonthlyIncome.value=data.budget.income;budgetNeeds.value=data.budget.needs;budgetWants.value=data.budget.wants;budgetSavings.value=data.budget.savings;budgetInvest.value=data.budget.invest;budgetError.textContent="";budgetDialog.showModal()};
document.querySelector("#budgetInfo").onclick=()=>budgetInfoDialog.showModal();
document.querySelector("#cancelBudget").onclick=()=>budgetDialog.close();
document.querySelector("#budgetForm").addEventListener("submit",e=>{e.preventDefault();const budget={income:Number(budgetMonthlyIncome.value),needs:Number(budgetNeeds.value),wants:Number(budgetWants.value),savings:Number(budgetSavings.value),invest:Number(budgetInvest.value)};if(budget.income<=0||Object.values(budget).slice(1).some(value=>value<0)||budget.needs+budget.wants+budget.savings+budget.invest!==100){budgetError.textContent="Use positive values and make the percentages total exactly 100%.";return}data.budget=budget;budgetError.textContent="";budgetDialog.close();save()});
document.querySelector("#resetBtn").onclick=()=>{if(confirm(`Reset all ${data.profileName} data?`)){localStorage.removeItem(KEY);location.reload()}};
document.querySelector("#exportBtn").onclick=()=>{
 const backup={app:"dans-wealth",version:1,exportedAt:new Date().toISOString(),data};
 const blob=new Blob([JSON.stringify(backup,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");
 link.href=url;link.download=`dans-wealth-backup-${today()}.json`;link.click();URL.revokeObjectURL(url);
};
document.querySelector("#importBtn").onclick=()=>document.querySelector("#importFile").click();
document.querySelector("#importFile").onchange=e=>{
 const file=e.target.files[0];if(!file)return;
 const reader=new FileReader();reader.onload=()=>{
  try{
   const backup=JSON.parse(reader.result),restored=backup.data||backup;
   if(!Array.isArray(restored.savings)||!Array.isArray(restored.expenses)||!Array.isArray(restored.stocks))throw new Error("invalid backup");
   if(confirm(`Restore backup from ${backup.exportedAt?new Date(backup.exportedAt).toLocaleString():"this file"}? Current data will be replaced.`)){localStorage.setItem(KEY,JSON.stringify(restored));location.reload()}
  }catch(error){alert(`That backup file is not valid for ${data.profileName}.`)}
  e.target.value="";
 };reader.readAsText(file);
};
if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js").catch(()=>{});
render();
window.addEventListener("online",syncFromServer);
window.addEventListener("offline",()=>setSyncStatus("Offline"));
syncFromServer();

function prepareTransferDialog(){
 const options=data.savings.map(account=>`<option value="${escapeHtml(account.name)}">${escapeHtml(account.name)}</option>`).join("");
 transferSource.innerHTML=options;transferDestination.innerHTML=options;transferError.textContent="";
 transferDestination.selectedIndex=data.savings.length>1?1:0;
}

function prepareStockDialog(){
 const options='<option value="">No linked account</option>'+data.savings.map(account=>`<option value="${escapeHtml(account.name)}">${escapeHtml(account.name)}</option>`).join("");
 investmentAccount.innerHTML=options;investmentError.textContent="";
}

function drawChart(range="week"){
 const canvas=document.querySelector("#activityChart"),context=canvas.getContext("2d"),width=canvas.clientWidth,height=canvas.clientHeight,dpr=window.devicePixelRatio||1;
 canvas.width=width*dpr;canvas.height=height*dpr;context.scale(dpr,dpr);context.clearRect(0,0,width,height);
 const days=range==="week"?7:range==="month"?30:90, labels=[],now=new Date();
 for(let index=days-1;index>=0;index--){const date=new Date(now);date.setDate(now.getDate()-index);labels.push(dateKey(date));}
 const savings=labels.map(date=>data.activity.filter(x=>x.type==="saving"&&x.date<=date).reduce((sum,x)=>sum+Number(x.amount||0),0));
 const expenses=labels.map(date=>data.activity.filter(x=>x.type==="expense"&&x.date<=date).reduce((sum,x)=>sum+Number(x.amount||0),0));
 const max=Math.max(...savings,...expenses,1),pad={top:16,right:12,bottom:25,left:42},chartWidth=width-pad.left-pad.right,chartHeight=height-pad.top-pad.bottom;
 context.font="10px sans-serif";context.strokeStyle="#222";context.fillStyle="#666";context.lineWidth=1;
 for(let line=0;line<=3;line++){const y=pad.top+chartHeight*line/3;context.beginPath();context.moveTo(pad.left,y);context.lineTo(width-pad.right,y);context.stroke();context.fillText(money(peso,max*(1-line/3)).replace(".00",""),4,y+3)}
 const drawLine=(values,color)=>{context.strokeStyle=color;context.lineWidth=2;context.beginPath();values.forEach((value,index)=>{const x=pad.left+chartWidth*index/(days-1),y=pad.top+chartHeight-(value/max)*chartHeight;index?context.lineTo(x,y):context.moveTo(x,y)});context.stroke()};
 drawLine(savings,"#7ee787");drawLine(expenses,"#ff7b72");
 context.fillStyle="#666";context.fillText(labels[0].slice(5),pad.left,height-7);context.fillText(labels[labels.length-1].slice(5),width-35,height-7);
}
window.addEventListener("resize",()=>drawChart(document.querySelector("[data-range].active")?.dataset.range||"week"));