// posts QBX price to a Discord webhook using Dexscreener public API
const WEBHOOK = process.env.DISCORD_WEBHOOK_URL;
const TOKEN   = (process.env.TOKEN_ADDRESS || '').trim().toLowerCase();
if (!WEBHOOK || !TOKEN) { console.error('Missing env'); process.exit(1); }
const DS_URL = `https://api.dexscreener.com/latest/dex/tokens/${TOKEN}`;
const fmt = (n, d=2) => (n==null||isNaN(n)) ? '-' :
  Number(n).toLocaleString(undefined,{maximumFractionDigits:d});

(async () => {
  try {
    const res = await fetch(DS_URL, { headers: { 'User-Agent':'qbx-price' }});
    const json = await res.json();
    const pairs = (json.pairs||[]).filter(p =>
      p.chainId==='ethereum' && (p.baseToken?.address||'').toLowerCase()===TOKEN);
    const pair = pairs.sort((a,b)=>(b.liquidity?.usd||0)-(a.liquidity?.usd||0))[0];

    let payload;
    if (!pair) {
      payload = { username:'QBX Price',
        embeds:[{ title:'QBX', description:
          'No live pair found on Ethereum yet. Add liquidity to enable price updates.',
          color:0x8e4dff, timestamp:new Date().toISOString() }] };
    } else {
      const ch=pair.priceChange||{}, liq=pair.liquidity||{}, vol=pair.volume||{};
      const priceUsd=Number(pair.priceUsd||0);
      const priceEth=pair.priceNative?Number(pair.priceNative):null;
      const url = pair.url || `https://dexscreener.com/${pair.chainId}/${pair.pairAddress}`;
      payload = { username:'QBX Price', embeds:[{
        title:'QBX / ETH', url, color:0xfff94a,
        fields:[
          {name:'Price (USD)', value:`$${fmt(priceUsd,6)}`, inline:true},
          {name:'Price (ETH)', value: priceEth?`${fmt(priceEth,8)} ETH`:'-', inline:true},
          {name:'\u200b', value:'\u200b', inline:true},
          {name:'Δ 1h', value:`${fmt(ch.h1,2)}%`, inline:true},
          {name:'Δ 24h', value:`${fmt(ch.h24,2)}%`, inline:true},
          {name:'Liquidity', value:`$${fmt(liq.usd,0)}`, inline:true},
          {name:'Vol 24h', value:`$${fmt(vol.h24,0)}`, inline:true},
          {name:'FDV (est.)', value: pair.fdv?`$${fmt(pair.fdv,0)}`:'-', inline:true},
        ],
        footer:{ text:'Data: Dexscreener' },
        timestamp:new Date().toISOString()
      }]};
    }
    await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)});
  } catch (e) {
    console.error(e);
    try {
      await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({username:'QBX Price',
          content:'Price updater hit an error. It will retry in 10 minutes.'})});
    } catch {}
    process.exit(1);
  }
})();
