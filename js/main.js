// clock
function tick(){
  const d = new Date();
  const el = document.getElementById('clock');
  if(el) el.textContent = d.toTimeString().slice(0,8);
}
tick(); setInterval(tick,1000);

// coordinate tracker
document.addEventListener('mousemove', (e)=>{
  const el = document.getElementById('coordTL');
  if(el) el.textContent = `X:${e.clientX} Y:${e.clientY}`;
});
