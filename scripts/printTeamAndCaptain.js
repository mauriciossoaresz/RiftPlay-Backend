// lista 1 time com 5, 1 time com <5, e o capitão (se houver)
const path=require('path'); require('dotenv').config({path:path.resolve(__dirname,'..','.env')});
const connect=require('../config/db'); const Time=require('../models/Time'); const Jogador=require('../models/Jogador');
(async ()=>{
  await connect();
  const times=await Time.find({}).select('_id players membros').limit(50).lean();
  const norm=t=>Array.isArray(t?.players)&&t.players.length?t.players
                 :Array.isArray(t?.membros)?t.membros.map(m=>m.playerId||m._id).filter(Boolean):[];
  let t5, tLess; for(const t of times){ const n=norm(t).length; if(n===5&&!t5) t5=t; if(n<5&&!tLess) tLess=t; }
  console.log('TEAM==5:', t5?._id?.toString()||null, 'count=', t5?norm(t5).length:0);
  console.log('TEAM<5 :', tLess?._id?.toString()||null, 'count=', tLess?norm(tLess).length:0);
  if (t5?._id){ const cap=await Jogador.findOne({ timeId:t5._id, $or:[{isCapitao:true},{isCaptain:true}] })
    .select('_id timeId isCapitao isCaptain').lean();
    console.log('CAPTAIN :', cap?._id?.toString()||null, 'isCapitao=', cap?.isCapitao||cap?.isCaptain||false);
  }
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
