import { advance, pickNext, recordRecent, offsetInto, seededRandom, stateSeed, skipCurrent, playNow } from "../netlify/functions/lib/playback.js";
let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++;} else {fail++; console.log("FAIL:", name);} }

const pool = [
  {id:"a",name:"A",seconds:100},
  {id:"b",name:"B",seconds:100},
  {id:"c",name:"C",seconds:100},
];

// Deterministic random: always pick first candidate
const firstPick = () => 0;

// 1) Bootstrap from empty state starts something at `now`
let s = advance({}, pool, 1000, {randomFn:firstPick});
ok("bootstrap sets nowPlaying", s.nowPlaying && s.nowPlaying.id==="a");
ok("bootstrap startedAt = now", s.startedAt===1000);

// 2) Within duration: no advance
let s2 = advance(s, pool, 1050, {randomFn:firstPick});
ok("no advance mid-track", s2.nowPlaying.id==="a" && s2.startedAt===1000);

// 3) After duration: advances to next, startedAt = previous end
let s3 = advance(s, pool, 1100, {randomFn:firstPick});
ok("advances at exact end", s3.nowPlaying.id!=="a");
ok("recorded a in recent", s3.recent[0]==="a");
ok("startedAt chains from end", s3.startedAt===1100);

// 4) Multiple elapsed tracks catch up in one call
let s4 = advance(s, pool, 1000+350, {randomFn:firstPick}); // 3.5 tracks elapsed
// a(1000-1100), then next..., should have advanced 3 times, 4th playing
ok("catches up multiple tracks", s4.startedAt <= 1350 && (1350 - s4.startedAt) < 100);

// 5) recent avoids repeats
let recent=["a","b"];
let n = pickNext(pool, recent, ()=>0);
ok("pickNext avoids recent", n.id==="c");

// 6) recordRecent caps at pool-1
let r=[];
for(const id of ["a","b","c","a","b"]) r=recordRecent(r,id,pool.length,10);
ok("recent capped at pool-1 (2)", r.length===2);
ok("recent newest first", r[0]==="b");

// 7) empty pool -> nothing plays
let e = advance({}, [], 1000);
ok("empty pool null", e.nowPlaying===null);

// 8) single-track pool keeps playing it
let one=[{id:"x",name:"X",seconds:60}];
let os = advance({}, one, 0, {randomFn:firstPick});
let os2 = advance(os, one, 200, {randomFn:firstPick}); // 3+ loops
ok("single track loops to itself", os2.nowPlaying.id==="x");

// 9) queue takes priority over pool pick
let q = advance({queue:[{id:"z",name:"Z",seconds:50}]}, pool, 500, {randomFn:firstPick});
ok("queue played first", q.nowPlaying.id==="z");

// 10) offsetInto
ok("offset correct", offsetInto({nowPlaying:{id:"a"},startedAt:1000}, 1042)===42);

// 11) zero-duration track doesn't infinite-loop
let zpool=[{id:"z1",seconds:0},{id:"z2",seconds:0}];
let zs = advance({}, zpool, 1000, {randomFn:firstPick});
ok("zero-dur bootstraps without hang", zs.nowPlaying!==null);

// 12) seeded pick: two requests advancing the same state agree
{
  const big = Array.from({length:30}, (_,i)=>({id:"t"+i,name:"T"+i,seconds:100}));
  const st = {nowPlaying:big[0], startedAt:1000, recent:[], queue:[]};
  const run = () => advance(st, big, 1100, {randomFn: seededRandom(stateSeed(st, 1100))});
  const a = run(), b = run();
  ok("same state → same next track", a.nowPlaying.id === b.nowPlaying.id && a.startedAt === b.startedAt);
  const picks = new Set();
  for (let k=0;k<20;k++){ const s2={...st, startedAt:1000+k*100}; picks.add(advance(s2,big,s2.startedAt+100,{randomFn:seededRandom(stateSeed(s2,0))}).nowPlaying.id); }
  ok("different states → varied picks", picks.size > 5);
  const r = seededRandom("x"); let inRange = true; for (let k=0;k<1000;k++){ const v=r(); if(v<0||v>=1) inRange=false; }
  ok("seeded values in [0,1)", inRange);
  ok("boot seed stable within a minute", stateSeed({}, 600) === stateSeed({}, 659));
}


// ---- Live controls (PR 2) ----
{
  const cpool=[{id:"a",name:"A",seconds:100},{id:"b",name:"B",seconds:100},{id:"c",name:"C",seconds:100}];
  const first=()=>0;
  let s = advance({}, cpool, 1000, {randomFn:first});
  let sk = advance(skipCurrent(s,1030), cpool, 1030, {randomFn:first});
  ok("skip moves off current", sk.nowPlaying.id!=="a");
  ok("skip records current in recent", sk.recent[0]==="a");
  let pn = advance(playNow(s, cpool[2], 1050, cpool.length), cpool, 1050, {randomFn:first});
  ok("playNow jumps to chosen track", pn.nowPlaying.id==="c");
  ok("playNow starts at now", pn.startedAt===1050);
  ok("playNow records previous", pn.recent.includes("a"));
  let none = skipCurrent({nowPlaying:null}, 5000);
  ok("skip idle no-op", !none.nowPlaying);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
