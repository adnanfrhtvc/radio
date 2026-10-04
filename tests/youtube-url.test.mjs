import { parseYouTube } from "../netlify/functions/lib/youtube-url.js";
let pass=0, fail=0;
function ok(name, cond){ if(cond){pass++;} else {fail++; console.log("FAIL:", name);} }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const V = (id) => ({ type: "video", id }), P = (id) => ({ type: "playlist", id });
const vid = "dQw4w9WgXcQ", pl = "PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI";

ok("watch url", eq(parseYouTube(`https://www.youtube.com/watch?v=${vid}`), V(vid)));
ok("youtu.be with tracking", eq(parseYouTube(`https://youtu.be/${vid}?si=x`), V(vid)));
ok("music.youtube", eq(parseYouTube(`https://music.youtube.com/watch?v=${vid}`), V(vid)));
ok("shorts", eq(parseYouTube(`https://youtube.com/shorts/${vid}`), V(vid)));
ok("playlist url", eq(parseYouTube(`https://youtube.com/playlist?list=${pl}`), P(pl)));
ok("video inside playlist → playlist", eq(parseYouTube(`https://youtube.com/watch?v=${vid}&list=${pl}`), P(pl)));
ok("Mix link → the video", eq(parseYouTube(`https://youtube.com/watch?v=${vid}&list=RD${vid}&start_radio=1`), V(vid)));
ok("raw video id", eq(parseYouTube(vid), V(vid)));
ok("raw playlist id", eq(parseYouTube(pl), P(pl)));
ok("html in list rejected", parseYouTube('https://youtube.com/playlist?list="><img src=x onerror=alert(1)>') === null);
ok("html in v rejected", parseYouTube('https://youtube.com/watch?v="><script>') === null);
ok("key smuggling rejected", parseYouTube("https://youtube.com/playlist?list=PLabcdefghij%26key%3Dx") === null);
ok("garbage", parseYouTube("hello") === null);
ok("empty", parseYouTube("") === null && parseYouTube(undefined) === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
